/**
 * Which queued events the worker may send on this tick.
 *
 * Pure and dependency-free (no server-only, no Supabase) so the ordering rule
 * can be tested on its own — it is the part that is easy to get wrong.
 */

export type QueuedEvent = {
  id: string;
  organization_id: string | null;
  created_at: string;
  next_attempt_at: string;
};

/**
 * At most one event per customer, and only its oldest one.
 *
 * A customer's events have to reach the portal in the order they happened:
 * a signup before any payment, "cancelled" before "reactivated". So a row
 * that is retrying holds back that one customer's later events — and nobody
 * else's. Rows with no organization have no ordering constraint and are keyed
 * individually.
 */
export function nextPerCustomer(
  pending: QueuedEvent[],
  now: Date,
): { due: string[]; blocked: number } {
  const oldest = new Map<string, QueuedEvent>();
  for (const row of pending) {
    const key = row.organization_id ?? `row:${row.id}`;
    const seen = oldest.get(key);
    if (!seen || row.created_at < seen.created_at) oldest.set(key, row);
  }

  const due: string[] = [];
  // Everything that is not the oldest for its customer is held back.
  let blocked = pending.length - oldest.size;
  for (const row of oldest.values()) {
    if (new Date(row.next_attempt_at) <= now) due.push(row.id);
    else blocked += 1;
  }
  return { due, blocked };
}
