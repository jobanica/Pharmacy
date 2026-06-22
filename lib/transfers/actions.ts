"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type TransferResult = { ok: true; transferId: string } | { error: string };
export type ReceiveResult = { ok: true } | { error: string };

export async function createTransfer(
  toBranchId: string,
  items: { productId: string; quantity: number }[],
  notes: string,
): Promise<TransferResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) return { error: "Permission denied" };
  if (items.length === 0) return { error: "Add at least one item" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_transfer", {
    p_from_branch: ctx.activeBranchId,
    p_to_branch: toBranchId,
    p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_notes: notes || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory/transfers");
  return { ok: true, transferId: data as string };
}

export async function receiveTransfer(transferId: string): Promise<ReceiveResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) return { error: "Permission denied" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_transfer", { p_transfer: transferId });
  if (error) return { error: error.message };

  revalidatePath(`/inventory/transfers/${transferId}`);
  revalidatePath("/inventory/transfers");
  return { ok: true };
}
