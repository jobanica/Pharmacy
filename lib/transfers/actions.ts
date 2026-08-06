"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type TransferResult = { ok: true; transferId: string } | { error: string };
export type ReceiveResult = { ok: true } | { error: string };

/**
 * Edit an in-transit transfer line's quantity. Increasing pulls the extra from
 * the line's source batch; decreasing returns stock to it. Setting 0 removes
 * the line. All handled atomically in SQL.
 */
export async function updateTransferItemQty(
  itemId: string,
  transferId: string,
  quantity: string,
): Promise<ReceiveResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) return { error: "Permission denied" };
  const n = parseInt(quantity, 10);
  if (!Number.isFinite(n) || n < 0) return { error: "Enter a valid quantity" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_transfer_item_qty", {
    p_item: itemId,
    p_new_qty: n,
  });
  if (error) return { error: error.message };

  revalidatePath(`/inventory/transfers/${transferId}`);
  revalidatePath("/inventory/transfers");
  return { ok: true };
}

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

/**
 * Edit an in-transit transfer's notes and/or destination branch. These don't
 * touch stock (the source was already deducted at creation; the destination is
 * only a label until it's received), so editing them is safe. Quantities and
 * products are intentionally NOT editable here — changing those would require
 * reversing and re-applying source-branch stock movements.
 */
export async function updateTransfer(
  transferId: string,
  toBranchId: string,
  notes: string,
): Promise<ReceiveResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) return { error: "Permission denied" };

  const supabase = await createClient();

  const { data: xfer } = await supabase
    .from("stock_transfers")
    .select("id, from_branch_id, status")
    .eq("id", transferId)
    .maybeSingle();
  if (!xfer) return { error: "Transfer not found" };
  if (xfer.status !== "in_transit") {
    return { error: "Only in-transit transfers can be edited" };
  }
  if (toBranchId === xfer.from_branch_id) {
    return { error: "Destination must differ from the source branch" };
  }

  // Destination must be a real branch in this org.
  const { data: dest } = await supabase
    .from("branches")
    .select("id")
    .eq("id", toBranchId)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (!dest) return { error: "Destination branch not found" };

  const { error } = await supabase
    .from("stock_transfers")
    .update({ to_branch_id: toBranchId, notes: notes.trim() || null })
    .eq("id", transferId);
  if (error) return { error: error.message };

  revalidatePath(`/inventory/transfers/${transferId}`);
  revalidatePath("/inventory/transfers");
  return { ok: true };
}

export async function receiveTransfer(transferId: string): Promise<ReceiveResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "use_transfers")) return { error: "Permission denied" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_transfer", { p_transfer: transferId });
  if (error) return { error: error.message };

  revalidatePath(`/inventory/transfers/${transferId}`);
  revalidatePath("/inventory/transfers");
  return { ok: true };
}
