"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type StocktakeResult = { ok: true; stocktakeId: string } | { error: string };
export type ApproveResult = { ok: true } | { error: string };

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
