/**
 * AI receipt scanner — extract a delivery/supplier receipt photo into structured
 * line items using Claude vision.
 *
 * Feature-flagged on the presence of ANTHROPIC_API_KEY (like billing is gated on
 * Xendit keys). When the key is absent the whole feature is OFF and callers show
 * a friendly "not configured" message instead of failing.
 *
 * Server-only. Never import this into a client component — it reads the API key.
 */
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** True when the Anthropic key is configured, i.e. the scanner can run. */
export function aiReceiptEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** One line item Claude reads off the receipt. */
export const receiptItemSchema = z.object({
  product_name: z
    .string()
    .describe("Product/medicine name as printed, including brand and strength"),
  generic_name: z
    .string()
    .nullable()
    .describe("Generic name if shown separately, else null"),
  quantity: z
    .number()
    .describe("Quantity of units received. Use 0 if you cannot read it."),
  unit_cost: z
    .number()
    .describe(
      "Cost PER UNIT in Philippine pesos (not the line total). 0 if unknown.",
    ),
  expiry_date: z
    .string()
    .nullable()
    .describe("Expiry date as ISO yyyy-mm-dd, or null if not printed"),
  batch_number: z
    .string()
    .nullable()
    .describe("Batch / lot number if printed, else null"),
});
export type ReceiptItem = z.infer<typeof receiptItemSchema>;

/** The full structured extraction returned by Claude. */
export const receiptExtractionSchema = z.object({
  supplier_name: z
    .string()
    .nullable()
    .describe("Supplier / distributor name printed on the receipt, else null"),
  items: z.array(receiptItemSchema),
});
export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

const SYSTEM_PROMPT = `You are a meticulous pharmacy receiving clerk in the Philippines.
You are given a photo or scan of a supplier delivery receipt, sales invoice, or
packing slip. Extract every product line into structured data.

Rules:
- Read the SUPPLIER / distributor name (usually at the top or in the header).
- For each product line, capture the product name exactly as printed (brand +
  strength, e.g. "Biogesic 500mg").
- unit_cost is the price PER UNIT in pesos. If the receipt only shows a line
  total, divide by the quantity to get the per-unit cost.
- Normalize any expiry date to ISO format yyyy-mm-dd. Philippine receipts often
  print dates as MM/DD/YY or "EXP 06/2027" — if only month/year is given, use the
  last day of that month. Return null if no expiry is printed for that line.
- Capture batch / lot numbers when printed (labelled LOT, BATCH, or B/N).
- Do NOT invent values. Use null (or 0 for numbers) when something is unreadable.
- Ignore non-product lines such as VAT, subtotal, discounts, delivery fees.`;

/** Strip a data: URL into its media type + base64 payload. */
export function parseImageDataUrl(
  dataUrl: string,
): { mediaType: string; data: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

const SUPPORTED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export type ScanOutcome =
  | { ok: true; data: ReceiptExtraction }
  | { ok: false; error: string };

/**
 * Send the receipt image to Claude and return the structured extraction.
 * Assumes aiReceiptEnabled() — callers should check the flag first.
 */
export async function extractReceipt(dataUrl: string): Promise<ScanOutcome> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return { ok: false, error: "That doesn't look like an image." };
  if (!SUPPORTED_MEDIA.has(parsed.mediaType)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP, or GIF image." };
  }
  // ~7.5MB of base64 ≈ 5.5MB binary — keep well under the API's per-image cap.
  if (parsed.data.length > 7_500_000) {
    return { ok: false, error: "Image too large — please use a smaller photo." };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type:
                  parsed.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: parsed.data,
              },
            },
            {
              type: "text",
              text: "Extract the supplier and all product line items from this receipt.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(receiptExtractionSchema) },
    });

    const data = response.parsed_output;
    if (!data) {
      return {
        ok: false,
        error: "Couldn't read the receipt. Try a clearer, well-lit photo.",
      };
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return {
        ok: false,
        error:
          err.status === 401
            ? "AI scanning is misconfigured (invalid API key)."
            : "The AI service couldn't process that image. Please try again.",
      };
    }
    return { ok: false, error: "Something went wrong scanning the receipt." };
  }
}
