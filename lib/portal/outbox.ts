import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  deliverEvent,
  productEventSchema,
  retryDelayMs,
  type AgentPortalConfig,
} from "@/lib/agent-kit";
import { nextPerCustomer } from "./ordering";
import { portalConfig } from "./config";

/**
 * The outbox worker: the only place in Reseta that talks to the agent portal
 * about events.
 *
 * Nothing in a user's request ever calls the portal. A signup, a receipt or a
 * suspension writes its event into product_event_outbox in the same
 * transaction as the business change, and this runs afterwards from cron. A
 * portal outage therefore shows up as a queue that drains late, never as a
 * failed signup.
 */

/** How many events one cron tick sends. Keeps the run well inside its timeout. */
const BATCH = 25;

export type OutboxRun = {
  configured: boolean;
  sent: number;
  failed: number;
  retried: number;
  /** Rows skipped because an earlier event for the same customer is waiting. */
  blocked: number;
};

/**
 * Send whatever is due. Safe to call concurrently-ish: two overlapping runs
 * can at worst deliver the same event twice, and the portal is idempotent on
 * event_id (it answers "duplicate").
 */
export async function runOutbox(
  config: AgentPortalConfig | null = portalConfig(),
  now = new Date(),
): Promise<OutboxRun> {
  const result: OutboxRun = { configured: config !== null, sent: 0, failed: 0, retried: 0, blocked: 0 };
  // Not configured yet: leave everything queued. It will go out untouched once
  // the three environment variables are set.
  if (!config) return result;

  const db = createServiceClient();
  const { data: pending } = await db
    .from("product_event_outbox")
    .select("id, organization_id, created_at, next_attempt_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(500);

  const { due, blocked } = nextPerCustomer(pending ?? [], now);
  result.blocked = blocked;
  if (due.length === 0) return result;

  const { data: rows } = await db
    .from("product_event_outbox")
    .select("*")
    .in("id", due.slice(0, BATCH));

  for (const row of rows ?? []) {
    const parsed = productEventSchema.safeParse(row.payload);
    if (!parsed.success) {
      // Malformed payloads can never be accepted; retrying would spin forever.
      // Park it as failed so it shows on the admin page instead.
      await db
        .from("product_event_outbox")
        .update({
          status: "failed",
          attempts: row.attempts + 1,
          last_error: `invalid payload: ${parsed.error.issues[0]?.message ?? "unknown"}`,
        })
        .eq("id", row.id);
      result.failed += 1;
      continue;
    }

    const outcome = await deliverEvent(config, parsed.data);
    const attempts = row.attempts + 1;

    if (outcome.kind === "delivered") {
      await db
        .from("product_event_outbox")
        .update({
          status: "sent",
          attempts,
          sent_at: new Date().toISOString(),
          portal_status: outcome.response.status,
          last_status: 200,
          last_error: outcome.response.error ?? null,
        })
        .eq("id", row.id);
      result.sent += 1;
    } else if (outcome.kind === "failed") {
      await db
        .from("product_event_outbox")
        .update({
          status: "failed",
          attempts,
          last_status: outcome.status,
          last_error: outcome.error,
        })
        .eq("id", row.id);
      result.failed += 1;
    } else {
      await db
        .from("product_event_outbox")
        .update({
          attempts,
          next_attempt_at: new Date(Date.now() + retryDelayMs(attempts)).toISOString(),
          last_status: outcome.status,
          last_error: outcome.error,
        })
        .eq("id", row.id);
      result.retried += 1;
    }
  }

  return result;
}

/**
 * Put a failed event back in the queue (the admin "Retry" button). Clears the
 * backoff so the next tick picks it up.
 */
export async function requeueEvent(id: string): Promise<void> {
  const db = createServiceClient();
  await db
    .from("product_event_outbox")
    .update({
      status: "pending",
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      last_status: null,
    })
    .eq("id", id)
    .eq("status", "failed");
}
