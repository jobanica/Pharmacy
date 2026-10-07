"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import {
  parseReceiptForm,
  requestSigningLink,
  uploadReceipt,
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
} from "@/lib/agent-kit";
import { portalConfig } from "./config";

export type PortalResult = { ok: true } | { error: string };

/**
 * Submit a bank-transfer receipt.
 *
 * Order matters: the image goes to the portal's private storage first, and only
 * a successful upload produces the receipt_path stored on the payment. The
 * image is never kept in Reseta — the portal is where receipts are reviewed,
 * and one copy means no second copy to go stale or leak.
 *
 * The payment row and its payment.submitted event are then written together by
 * submit_manual_payment(), in one transaction. Reseta records that a payment
 * was submitted; whether it is accepted is the portal's call, and nothing here
 * changes the plan, the account status, or how billing works.
 */
export async function submitReceiptAction(formData: FormData): Promise<PortalResult> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the pharmacy owner can submit a payment." };

  const parsed = parseReceiptForm({
    type: (formData.get("type") as string) ?? undefined,
    amount: (formData.get("amount") as string) ?? undefined,
    bank_reference: (formData.get("bank_reference") as string) ?? undefined,
    months_covered: (formData.get("months_covered") as string) ?? undefined,
    billing_month_start: (formData.get("billing_month_start") as string) ?? undefined,
  });
  if (!parsed.ok) return { error: parsed.error };
  const input = parsed.input;

  const config = portalConfig();
  if (!config) {
    return {
      error:
        "Payments are not set up on this deployment yet. Please contact support before paying.",
    };
  }

  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Attach a photo or screenshot of your bank receipt." };
  }
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) {
    return { error: "The receipt must be a JPEG, PNG or WebP image." };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { error: "The receipt image must be under 4 MB." };
  }

  const uploaded = await uploadReceipt(
    config,
    new Uint8Array(await file.arrayBuffer()),
    file.type,
  );
  if (!uploaded.ok) return { error: uploaded.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_manual_payment", {
    p_type: input.type,
    p_months: input.monthsCovered,
    p_month_start: input.billingMonth ? `${input.billingMonth}-01` : null,
    p_amount: input.amount,
    p_bank_ref: input.bankReference,
    p_receipt_path: uploaded.receiptPath,
  });
  if (error) return { error: error.message };

  const result = data as { ok?: boolean; error?: string } | null;
  if (!result?.ok) return { error: result?.error ?? "The payment could not be submitted." };

  revalidatePath("/settings/billing");
  return { ok: true };
}

export type SigningLink = { url: string } | { error: string };

/**
 * A link to the portal's own signing page for this pharmacy.
 *
 * The agreement lives on the portal, not here: it is the portal that records
 * the signature and the minimum term, and it tells us through
 * `contract.signed`. Reseta only sends the owner there.
 */
export async function requestContractLinkAction(): Promise<SigningLink> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") {
    return { error: "Only the pharmacy owner can sign the service agreement." };
  }

  const config = portalConfig();
  if (!config) return { error: "The agreement is not available yet. Please contact support." };

  const link = await requestSigningLink(config, ctx.organization.id);
  if (!link) {
    return {
      error: "The agreement isn't ready yet. Please try again in a moment.",
    };
  }
  return { url: link.url };
}
