import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { GRACE_DAYS } from "./grace";

/**
 * Suspend accounts whose coverage lapsed more than the grace period ago.
 *
 * Driven by the clock, not by an event: nothing calls us when coverage simply
 * runs out, so the outbox cron sweeps for it. Only accounts that signed up
 * through an agent AND have had a monthly payment confirmed are ever in scope,
 * so a pharmacy that never used this flow cannot be suspended by it.
 *
 * Returns how many were suspended this run (usually zero).
 */
export async function suspendLapsedAccounts(): Promise<number> {
  const db = createServiceClient();
  const { data, error } = await db.rpc("suspend_lapsed_accounts", {
    p_grace_days: GRACE_DAYS,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}
