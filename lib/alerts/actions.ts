"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type Result = { ok: true } | { error: string };

/** Write off a batch (expiry/damage): zeroes it and logs an expiry_writeoff. */
export async function writeOffBatch(
  batchId: string,
  reason?: string,
): Promise<Result> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_stock")) {
    return { error: "You do not have permission to write off stock" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("write_off_batch", {
    p_batch: batchId,
    ...(reason?.trim() ? { p_reason: reason.trim() } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/alerts");
  revalidatePath("/inventory");
  return { ok: true };
}
