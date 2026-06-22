"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { pesosToCentavos } from "@/lib/money";

export type ShiftResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { error: string };

export async function openShift(openingCash: string): Promise<ShiftResult<string>> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "create_sale")) return { error: "Permission denied" };

  const centavos = openingCash ? pesosToCentavos(openingCash) : 0;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_shift", {
    p_branch: ctx.activeBranchId,
    p_opening_cash: centavos,
  });
  if (error) return { error: error.message };

  revalidatePath("/pos/shift");
  return { ok: true, data: data as string };
}

export async function closeShift(
  shiftId: string,
  closingCash: string,
  notes: string,
): Promise<ShiftResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "create_sale")) return { error: "Permission denied" };

  const centavos = closingCash ? pesosToCentavos(closingCash) : 0;
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_shift", {
    p_shift: shiftId,
    p_closing_cash: centavos,
    p_notes: notes || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/pos/shift");
  return { ok: true };
}
