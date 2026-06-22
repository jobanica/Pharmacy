"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type ReturnResult =
  | { ok: true; returnId: string }
  | { error: string };

export async function processReturn(
  saleId: string,
  items: { productId: string; quantity: number }[],
  reason: string,
): Promise<ReturnResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "void_sale")) {
    return { error: "Only managers or pharmacists can process returns" };
  }
  if (items.length === 0) return { error: "No items selected" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("process_return", {
    p_sale: saleId,
    p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_reason: reason || undefined,
  });
  if (error) return { error: error.message };

  return { ok: true, returnId: data as string };
}
