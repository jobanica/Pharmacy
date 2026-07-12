import type { Json } from "@/lib/supabase/types";

export const DEFAULT_EXPIRY_ALERT_DAYS = 90;

/** Read the org's configured expiry-alert window (days), clamped to 1..730. */
export function readExpiryAlertDays(settings: Json | null | undefined): number {
  const root = (settings ?? {}) as { alerts?: { expiry_days?: unknown } };
  const raw = Number(root.alerts?.expiry_days);
  if (!Number.isFinite(raw)) return DEFAULT_EXPIRY_ALERT_DAYS;
  return Math.min(730, Math.max(1, Math.trunc(raw)));
}
