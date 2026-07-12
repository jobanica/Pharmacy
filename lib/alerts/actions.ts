"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import type { Json } from "@/lib/supabase/types";

export type Result = { ok: true } | { error: string };

export const DEFAULT_EXPIRY_ALERT_DAYS = 90;

/** Read the org's configured expiry-alert window (days), clamped to 1..730. */
export function readExpiryAlertDays(settings: Json | null | undefined): number {
  const root = (settings ?? {}) as { alerts?: { expiry_days?: unknown } };
  const raw = Number(root.alerts?.expiry_days);
  if (!Number.isFinite(raw)) return DEFAULT_EXPIRY_ALERT_DAYS;
  return Math.min(730, Math.max(1, Math.trunc(raw)));
}

/** Owner/manager sets how many days before expiry to start alerting. */
export async function updateExpiryAlertDays(days: number): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { error: "Only an owner or manager can change alert settings" };
  }
  const n = Math.trunc(Number(days));
  if (!Number.isFinite(n) || n < 1 || n > 730) {
    return { error: "Enter a number of days between 1 and 730" };
  }

  const supabase = await createClient();
  const current = (ctx.organization.settings ?? {}) as Record<string, unknown>;
  const alerts = (current.alerts ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("organizations")
    .update({
      settings: { ...current, alerts: { ...alerts, expiry_days: n } } as Json,
    })
    .eq("id", ctx.organization.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/alerts");
  return { ok: true };
}

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
