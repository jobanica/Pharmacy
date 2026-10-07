import { NextResponse, type NextRequest } from "next/server";

import { runOutbox } from "@/lib/portal/outbox";

/**
 * The agent-portal outbox worker. Scheduled every minute by vercel.json.
 *
 * This is the only place that sends events to the portal, so a portal outage
 * shows up here as a queue that drains late rather than as a failed signup or
 * a failed receipt upload.
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

  const result = await runOutbox();
  return NextResponse.json(result);
}
