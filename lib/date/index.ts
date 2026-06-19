/**
 * Date / timezone helpers.
 *
 * All timestamps are stored as `timestamptz` (UTC) in Postgres. The business
 * day is always reckoned in **Asia/Manila** (PHT, UTC+8, no DST). Use these
 * helpers anywhere a "today" / "daily sales close" boundary matters so that a
 * sale at 11pm Manila lands on the correct local day regardless of server TZ.
 */
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

export const MANILA_TZ = "Asia/Manila";

/** The current Manila wall-clock time as a Date (shifted for display math). */
export function nowInManila(): Date {
  return toZonedTime(new Date(), MANILA_TZ);
}

/** Manila business day as "yyyy-MM-dd" for a given instant (default: now). */
export function manilaBusinessDay(instant: Date = new Date()): string {
  return formatInTimeZone(instant, MANILA_TZ, "yyyy-MM-dd");
}

/**
 * UTC instants for the start (inclusive) and end (exclusive) of a Manila
 * calendar day. Pass these to range queries: created_at >= start && < end.
 */
export function manilaDayRange(day: string): { startUtc: Date; endUtc: Date } {
  const startUtc = fromZonedTime(`${day}T00:00:00`, MANILA_TZ);
  const endUtc = fromZonedTime(`${day}T00:00:00`, MANILA_TZ);
  endUtc.setUTCDate(endUtc.getUTCDate() + 1);
  return { startUtc, endUtc };
}

/** Format an instant for display in Manila, e.g. "Jun 18, 2026, 3:45 PM". */
export function formatManila(
  instant: Date | string,
  pattern = "MMM d, yyyy, h:mm a",
): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return formatInTimeZone(d, MANILA_TZ, pattern);
}

/** A date `n` days before now as `yyyy-MM-dd` (used for default report ranges). */
export function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from now (Manila) until a date-only `yyyy-MM-dd` (e.g. expiry). */
export function daysUntil(dateOnly: string): number {
  const today = new Date(`${manilaBusinessDay()}T00:00:00Z`).getTime();
  const target = new Date(`${dateOnly}T00:00:00Z`).getTime();
  return Math.round((target - today) / 86_400_000);
}
