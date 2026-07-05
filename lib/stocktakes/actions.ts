"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type StocktakeResult = { ok: true; stocktakeId: string } | { error: string };
export type ApproveResult = { ok: true } | { error: string };
export type DiscardResult = { ok: true } | { error: string };

/** Discard (delete) a draft stocktake so a new one can be started. Draft only. */
export async function discardStocktake(stocktakeId: string): Promise<DiscardResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) return { error: "Permission denied" };

  const db = createServiceClient();
  const { data: st } = await db
    .from("stocktakes")
    .select("id, status, organization_id")
    .eq("id", stocktakeId)
    .maybeSingle();
  if (!st || st.organization_id !== ctx.organization.id) {
    return { error: "Stocktake not found" };
  }
  if (st.status !== "draft") {
    return { error: "Only a draft stocktake can be discarded" };
  }

  // stocktake_items cascade-delete with the stocktake; nothing else is touched
  // (inventory is only affected on approve).
  const { error } = await db.from("stocktakes").delete().eq("id", stocktakeId);
  if (error) return { error: error.message };

  revalidatePath("/inventory/stocktake");
  return { ok: true };
}

export async function startStocktake(notes: string): Promise<StocktakeResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) return { error: "Permission denied" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_stocktake", {
    p_branch: ctx.activeBranchId,
    p_notes: notes || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/inventory/stocktake");
  return { ok: true, stocktakeId: data as string };
}

export async function saveCount(
  itemId: string,
  countedQty: number,
): Promise<{ ok: true } | { error: string }> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) return { error: "Permission denied" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("stocktake_items")
    .update({ counted_qty: countedQty })
    .eq("id", itemId);
  if (error) return { error: error.message };

  return { ok: true };
}

export async function approveStocktake(stocktakeId: string): Promise<ApproveResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "void_sale")) return { error: "Only managers or owners can approve" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_stocktake", { p_stocktake: stocktakeId });
  if (error) return { error: error.message };

  revalidatePath(`/inventory/stocktake/${stocktakeId}`);
  revalidatePath("/inventory/stocktake");
  return { ok: true };
}
