"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type Result = { ok: true } | { error: string };

/**
 * Write off an expiring batch as EXPIRED: removes its full remaining quantity
 * and records the loss cost (so it appears in Stock Adjustments → Expired).
 */
export async function writeOffBatch(
  batchId: string,
  notes?: string,
): Promise<Result> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_stock")) {
    return { error: "You do not have permission to write off stock" };
  }
  const supabase = await createClient();

  const { data: batch } = await supabase
    .from("batches")
    .select("quantity")
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) return { error: "Batch not found" };
  if (batch.quantity <= 0) return { error: "This batch is already empty" };

  const { error } = await supabase.rpc("write_off_stock", {
    p_batch: batchId,
    p_quantity: batch.quantity,
    p_reason: "expired",
    ...(notes?.trim() ? { p_notes: notes.trim() } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/alerts");
  revalidatePath("/inventory");
  revalidatePath("/inventory/adjustments");
  return { ok: true };
}
