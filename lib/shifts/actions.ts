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

export type ShiftSummary = {
  openedAt: string;
  closedAt: string;
  cashierName: string;
  branchName: string;
  storeName: string;
  salesCount: number;
  grossCentavos: number;
  discountCentavos: number;
  netCentavos: number;
  openingCashCentavos: number;
  closingCashCentavos: number;
  overShortCentavos: number;
  cashCollectedCentavos: number;
};

export async function closeShift(
  shiftId: string,
  closingCash: string,
  notes: string,
): Promise<ShiftResult<ShiftSummary>> {
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

  // Fetch summary for the closed shift to return to the client for printing.
  const [{ data: shift }, { data: cashPayments }, { data: branch }, { data: profile }] =
    await Promise.all([
      supabase
        .from("cashier_shifts")
        .select("opened_at, closed_at, sales_count, gross_centavos, net_centavos, opening_cash_centavos, closing_cash_centavos, over_short_centavos, cashier_id, branch_id")
        .eq("id", shiftId)
        .maybeSingle(),
      supabase
        .from("sale_payments")
        .select("amount_centavos, sales!inner(shift_id, status)")
        .eq("method", "cash")
        .eq("sales.shift_id", shiftId)
        .eq("sales.status", "completed"),
      supabase.from("branches").select("name").eq("id", ctx.activeBranchId).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", ctx.user.id).maybeSingle(),
    ]);

  const { readBrand } = await import("@/lib/branding");
  const brand = readBrand(ctx.organization.settings);
  const grossC = (shift?.gross_centavos ?? 0);
  const netC = (shift?.net_centavos ?? 0);
  const discountC = grossC - netC;
  const cashCollected = (cashPayments ?? []).reduce((s, p) => s + p.amount_centavos, 0);

  revalidatePath("/pos/shift");
  return {
    ok: true,
    data: {
      openedAt: shift?.opened_at ?? "",
      closedAt: shift?.closed_at ?? new Date().toISOString(),
      cashierName: profile?.full_name ?? ctx.user.id,
      branchName: branch?.name ?? "",
      storeName: brand.name,
      salesCount: shift?.sales_count ?? 0,
      grossCentavos: grossC,
      discountCentavos: discountC,
      netCentavos: netC,
      openingCashCentavos: shift?.opening_cash_centavos ?? 0,
      closingCashCentavos: shift?.closing_cash_centavos ?? centavos,
      overShortCentavos: shift?.over_short_centavos ?? 0,
      cashCollectedCentavos: cashCollected,
    },
  };
}
