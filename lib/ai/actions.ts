"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { requireAppContext, type AppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { pesosToCentavos } from "@/lib/money";
import { aiReceiptEnabled, extractReceipt } from "@/lib/ai/receipt";
import { canUseAiScan, isAiScanUnlimited } from "@/lib/billing/plans";

export type Result = { ok: true } | { error: string };

async function guard(): Promise<{ error: string } | { ctx: AppContext }> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) {
    return { error: "You do not have permission to receive stock" };
  }
  return { ctx };
}

/** Normalize a name for fuzzy matching (lowercase, collapse whitespace). */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export type ScannedLine = {
  productName: string;
  genericName: string | null;
  quantity: number;
  unitCost: number;
  expiryDate: string | null;
  batchNumber: string | null;
  /** Suggested existing product to match against, if any. */
  matchProductId: string | null;
  matchProductName: string | null;
};

export type ScanResult =
  | {
      ok: true;
      supplierName: string | null;
      matchSupplierId: string | null;
      lines: ScannedLine[];
    }
  | { error: string };

/**
 * Scan a receipt image: send it to Claude, then suggest matches against the
 * org's existing products and suppliers so the user can review before importing.
 */
export async function scanReceipt(dataUrl: string): Promise<ScanResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };

  const plan = g.ctx.organization.plan;
  if (!canUseAiScan(plan)) {
    return { error: "AI receipt scanning requires the Starter plan or higher. Upgrade in Settings → Billing." };
  }

  if (!aiReceiptEnabled()) {
    return {
      error:
        "AI receipt scanning isn't configured. Add an ANTHROPIC_API_KEY to enable it.",
    };
  }

  // Starter plan: rate-limit to 1 scan per 7 days.
  if (!isAiScanUnlimited(plan)) {
    const supabaseCheck = await createClient();
    const { data: orgRow } = await supabaseCheck
      .from("organizations")
      .select("settings")
      .eq("id", g.ctx.organization.id)
      .maybeSingle();
    const settings = (orgRow?.settings ?? {}) as Record<string, unknown>;
    const lastScan = settings.last_ai_scan_at as string | undefined;
    if (lastScan) {
      const daysSince = (Date.now() - new Date(lastScan).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        const nextAvailable = new Date(new Date(lastScan).getTime() + 7 * 24 * 60 * 60 * 1000);
        return {
          error: `Starter plan allows 1 AI scan per week. Next scan available: ${nextAvailable.toLocaleDateString("en-PH")}. Upgrade to Pro for unlimited scans.`,
        };
      }
    }
    // Record this scan timestamp.
    await supabaseCheck
      .from("organizations")
      .update({ settings: { ...settings, last_ai_scan_at: new Date().toISOString() } })
      .eq("id", g.ctx.organization.id);
  }

  const outcome = await extractReceipt(dataUrl);
  if (!outcome.ok) return { error: outcome.error };

  const supabase = await createClient();
  // Page through every product so matching works for large catalogs (PostgREST
  // caps a response at 1000 rows — otherwise scanned items past the first 1000
  // wouldn't match and would be created as duplicates).
  const [productList, { data: suppliers }] = await Promise.all([
    fetchAllRows<{ id: string; name: string; generic_name: string | null }>((from, to) =>
      supabase.from("products").select("id, name, generic_name").range(from, to),
    ),
    supabase.from("suppliers").select("id, name"),
  ]);
  const byName = new Map(productList.map((p) => [norm(p.name), p]));

  function matchProduct(name: string): { id: string; name: string } | null {
    const key = norm(name);
    const exact = byName.get(key);
    if (exact) return { id: exact.id, name: exact.name };
    // Fall back to a contains match (either direction) on name or generic.
    const partial = productList.find((p) => {
      const pn = norm(p.name);
      const gn = p.generic_name ? norm(p.generic_name) : "";
      return (
        pn.includes(key) || key.includes(pn) || (gn && (gn.includes(key) || key.includes(gn)))
      );
    });
    return partial ? { id: partial.id, name: partial.name } : null;
  }

  const lines: ScannedLine[] = outcome.data.items.map((it) => {
    const match = matchProduct(it.product_name);
    return {
      productName: it.product_name,
      genericName: it.generic_name,
      quantity: Number.isFinite(it.quantity) ? Math.max(0, Math.round(it.quantity)) : 0,
      unitCost: Number.isFinite(it.unit_cost) ? Math.max(0, it.unit_cost) : 0,
      expiryDate: it.expiry_date,
      batchNumber: it.batch_number,
      matchProductId: match?.id ?? null,
      matchProductName: match?.name ?? null,
    };
  });

  let matchSupplierId: string | null = null;
  if (outcome.data.supplier_name) {
    const key = norm(outcome.data.supplier_name);
    const sup = (suppliers ?? []).find((s) => norm(s.name) === key);
    matchSupplierId = sup?.id ?? null;
  }

  return {
    ok: true,
    supplierName: outcome.data.supplier_name,
    matchSupplierId,
    lines,
  };
}

// ---------------------------------------------------------------------------
// Import the reviewed receipt into inventory
// ---------------------------------------------------------------------------
const importLineSchema = z
  .object({
    // Either an existing product id, or a name to create a new product.
    productId: z.string().uuid().optional().or(z.literal("")),
    newProductName: z.string().max(200).optional().or(z.literal("")),
    newGenericName: z.string().max(200).optional().or(z.literal("")),
    quantity: z.coerce.number().int().positive(),
    unitCost: z.coerce.number().min(0).default(0),
    expiryDate: z.string().optional().or(z.literal("")),
    batchNumber: z.string().max(64).optional().or(z.literal("")),
  })
  .refine((l) => (l.productId && l.productId.length > 0) || (l.newProductName ?? "").trim().length > 0, {
    message: "Each line needs a matched product or a name to create one",
  });

const importReceiptSchema = z
  .object({
    supplierId: z.string().uuid().optional().or(z.literal("")),
    newSupplierName: z.string().max(200).optional().or(z.literal("")),
    // The scanned receipt image (data URL), saved for record-keeping.
    imageDataUrl: z.string().optional().or(z.literal("")),
    lines: z.array(importLineSchema).min(1, "Nothing to import"),
  })
  .refine(
    (v) => (v.supplierId && v.supplierId.length > 0) || (v.newSupplierName ?? "").trim().length > 0,
    { message: "A supplier is required before importing a receipt" },
  );
export type ImportReceiptInput = z.input<typeof importReceiptSchema>;

export type ImportResult = { ok: true; received: number } | { error: string };

/**
 * Receive the reviewed receipt lines into the active branch: ensure the
 * supplier exists, create any new products, then receive_stock each line with
 * the supplier attached (so near-expiry alerts reveal who supplied it).
 */
export async function importReceipt(input: ImportReceiptInput): Promise<ImportResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = importReceiptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const orgId = g.ctx.organization.id;

  // 1. Resolve the supplier (existing id wins; else find-or-create by name).
  let supplierId: string | null = d.supplierId && d.supplierId.length > 0 ? d.supplierId : null;
  const newSupplierName = (d.newSupplierName ?? "").trim();
  if (!supplierId && newSupplierName) {
    const { data: existing } = await supabase
      .from("suppliers")
      .select("id, name")
      .ilike("name", newSupplierName)
      .maybeSingle();
    if (existing) {
      supplierId = existing.id;
    } else {
      const { data: created, error: supErr } = await supabase
        .from("suppliers")
        .insert({ organization_id: orgId, name: newSupplierName })
        .select("id")
        .single();
      if (supErr) return { error: `Couldn't save supplier: ${supErr.message}` };
      supplierId = created.id;
    }
  }

  // A supplier is mandatory so expiring stock can always be traced to who
  // supplied it (also enforced client-side and by the schema).
  if (!supplierId) {
    return { error: "A supplier is required before importing a receipt" };
  }

  // 2. Receive each line, creating products as needed.
  let received = 0;
  for (const line of d.lines) {
    let productId = line.productId && line.productId.length > 0 ? line.productId : null;

    if (!productId) {
      const name = (line.newProductName ?? "").trim();
      const generic = (line.newGenericName ?? "").trim();
      const { data: createdProduct, error: prodErr } = await supabase
        .from("products")
        .insert({
          organization_id: orgId,
          name,
          generic_name: generic || null,
        })
        .select("id")
        .single();
      if (prodErr) return { error: `Couldn't create "${name}": ${prodErr.message}` };
      productId = createdProduct.id;
    }

    const batchNumber = (line.batchNumber ?? "").trim();
    const expiry = (line.expiryDate ?? "").trim();
    const { error: rpcErr } = await supabase.rpc("receive_stock", {
      p_branch: g.ctx.activeBranchId,
      p_product: productId,
      p_quantity: line.quantity,
      p_cost_centavos: pesosToCentavos(line.unitCost),
      ...(supplierId ? { p_supplier: supplierId } : {}),
      ...(batchNumber ? { p_batch_number: batchNumber } : {}),
      ...(expiry ? { p_expiry: expiry } : {}),
    });
    if (rpcErr) return { error: `Couldn't receive "${line.newProductName ?? productId}": ${rpcErr.message}` };
    received += 1;
  }

  // 3. Save the scanned receipt image + a record for future reference.
  const totalCost = d.lines.reduce(
    (s, l) => s + pesosToCentavos(l.unitCost) * Number(l.quantity),
    0,
  );
  const dataUrl = d.imageDataUrl ?? "";
  let imagePath: string | null = null;
  if (dataUrl.startsWith("data:image/")) {
    const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const bytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
    if (bytes.length > 0 && bytes.length <= 8_000_000) {
      const path = `${orgId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const service = createServiceClient();
      const { error: upErr } = await service.storage
        .from("receipts")
        .upload(path, bytes, { contentType: mime, upsert: false });
      if (!upErr) imagePath = path;
    }
  }
  // Record the scan even when no image was provided (keeps an audit trail).
  await supabase.from("receipt_scans").insert({
    organization_id: orgId,
    branch_id: g.ctx.activeBranchId,
    supplier_id: supplierId,
    image_path: imagePath ?? "",
    item_count: received,
    total_cost_centavos: totalCost,
    created_by: g.ctx.user.id,
  });

  revalidatePath("/inventory");
  revalidatePath("/suppliers");
  revalidatePath("/alerts");
  revalidatePath("/purchase-orders/receipts");
  return { ok: true, received };
}
