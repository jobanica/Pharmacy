import { NextResponse, type NextRequest } from "next/server";

import { runOutbox } from "@/lib/portal/outbox";
import { suspendLapsedAccounts } from "@/lib/portal/billing";

/**
 * The agent-portal outbox worker, plus the lapsed-subscription sweep.
 *
 * This is the only place that sends events to the portal, so a portal outage
 * shows up here as a queue that drains late rather than as a failed signup or
 * a failed receipt upload.
 *
 * The sweep rides along because a lapse is driven by the clock, not by an
 * event — nothing calls us when coverage simply runs out. It runs first, so
 * any customer.cancelled it queues goes out on this same tick.
 *
 * Vercel signs its cron invocations with CRON_SECRET when that variable is
 * set. The guard is skipped when it is not, so the route works out of the box
 * in development; set CRON_SECRET in production to close it.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A failed sweep must not stop the queue from draining — they are
  // independent jobs that happen to share a tick.
  let suspended = 0;
  let sweepError: string | null = null;
  try {
    suspended = await suspendLapsedAccounts();
  } catch (e) {
    sweepError = e instanceof Error ? e.message : String(e);
  }

  const result = await runOutbox();
  return NextResponse.json({ ...result, suspended, sweepError });
}
