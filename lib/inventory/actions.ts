"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext, type AppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { pesosToCentavos } from "@/lib/money";
import {
  receiveStockSchema,
  adjustBatchSchema,
  type ReceiveStockInput,
  type AdjustBatchInput,
} from "@/lib/validation/inventory";

export type Result = { ok: true } | { error: string };

async function guard(): Promise<{ error: string } | { ctx: AppContext }> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_stock")) {
    return { error: "You do not have permission to manage stock" };
  }
  return { ctx };
}

/** Receive stock into the active branch: extends/creates a batch + logs it. */
export async function receiveStock(input: ReceiveStockInput): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = receiveStockSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const batchNumber = d.batchNumber?.trim();
  const { error } = await supabase.rpc("receive_stock", {
    p_branch: g.ctx.activeBranchId,
    p_product: d.productId,
    p_quantity: d.quantity,
    p_cost_centavos: pesosToCentavos(d.cost),
    ...(d.supplierId ? { p_supplier: d.supplierId } : {}),
    ...(batchNumber ? { p_batch_number: batchNumber } : {}),
    ...(d.expiryDate ? { p_expiry: d.expiryDate } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${d.productId}`);
  return { ok: true };
}

export type WriteOffResult = { ok: true; totalCostCentavos: number } | { error: string };

export type BatchOption = {
  id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
  cost_centavos: number;
};

/** Batches with stock for a product at the active branch (for the write-off picker). */
export async function getProductBatches(productId: string): Promise<BatchOption[]> {
  const g = await guard();
  if ("error" in g) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("batches")
    .select("id, batch_number, expiry_date, quantity, cost_centavos")
    .eq("branch_id", g.ctx.activeBranchId)
    .eq("product_id", productId)
    .gt("quantity", 0)
    .order("expiry_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as BatchOption[];
}

/** Write off stock (expired / damaged / other) from a batch; records the cost. */
export async function writeOffStock(
  batchId: string,
  quantity: number | string,
  reason: "expired" | "damaged" | "other" | "donated",
  notes: string,
): Promise<WriteOffResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };

  const qty = Math.trunc(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) return { error: "Enter a quantity" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("write_off_stock", {
    p_batch: batchId,
    p_quantity: qty,
    p_reason: reason,
    ...(notes.trim() ? { p_notes: notes.trim() } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath("/inventory/adjustments");
  revalidatePath("/alerts");
  const totalCostCentavos = (data as { total_cost_centavos?: number } | null)?.total_cost_centavos ?? 0;
  return { ok: true, totalCostCentavos };
}

/** Set a batch's quantity to an absolute value, logging the signed delta. */
export async function adjustBatch(
  input: AdjustBatchInput,
  productId: string,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = adjustBatchSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const reason = d.reason?.trim();
  const { error } = await supabase.rpc("adjust_batch", {
    p_batch: d.batchId,
    p_new_quantity: d.newQuantity,
    ...(reason ? { p_reason: reason } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${productId}`);
  return { ok: true };
}
