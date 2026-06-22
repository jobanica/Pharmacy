"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { completeSaleSchema, type CompleteSaleInput } from "@/lib/validation/pos";

export type CompleteResult = { ok: true; saleId: string } | { error: string };
export type VoidResult = { ok: true } | { error: string };

/** Complete a cash sale at the active branch (atomic FEFO deduction in SQL). */
export async function completeSale(
  input: CompleteSaleInput,
): Promise<CompleteResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "create_sale")) {
    return { error: "You do not have permission to make sales" };
  }
  const parsed = completeSaleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_sale", {
    p_branch: ctx.activeBranchId,
    p_items: d.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_discount_centavos: d.discountCentavos,
    p_amount_tendered_centavos: d.amountTenderedCentavos,
    ...(d.customerId ? { p_customer: d.customerId } : {}),
    ...(d.redeemPoints ? { p_redeem_points: d.redeemPoints } : {}),
    p_discount_type: d.discountType,
    ...(d.beneficiaryIdNo ? { p_beneficiary_id_no: d.beneficiaryIdNo } : {}),
    ...(d.beneficiaryName ? { p_beneficiary_name: d.beneficiaryName } : {}),
    ...(d.prescriptionId ? { p_prescription_id: d.prescriptionId } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/pos");
  return { ok: true, saleId: data as string };
}

/** Void a completed sale (owner/manager); restores stock + logs movements. */
export async function voidSale(saleId: string): Promise<VoidResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "void_sale")) {
    return { error: "Only an owner or manager can void a sale" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale: saleId });
  if (error) return { error: error.message };

  revalidatePath(`/pos/receipt/${saleId}`);
  revalidatePath("/pos");
  return { ok: true };
}
