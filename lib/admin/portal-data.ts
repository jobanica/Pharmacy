import "server-only";

/**
 * Read side of the agent-portal admin page. Service role (cross-tenant); only
 * call after requirePlatformAdmin().
 */
import { createServiceClient } from "@/lib/supabase/service";

export type PortalEventRow = {
  id: string;
  orgName: string | null;
  type: string;
  eventId: string;
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
};

export type PortalQueue = {
  failed: PortalEventRow[];
  pending: number;
  sent: number;
};

export async function getPortalQueue(): Promise<PortalQueue> {
  const db = createServiceClient();

  const [{ data: failed }, pendingCount, sentCount] = await Promise.all([
    db
      .from("product_event_outbox")
      .select("id, organization_id, type, event_id, attempts, last_status, last_error, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("product_event_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("product_event_outbox").select("id", { count: "exact", head: true }).eq("status", "sent"),
  ]);

  // Named separately: the outbox carries no PostgREST relationship to
  // organizations, and a failed queue is short enough that one lookup does.
  const orgIds = [...new Set((failed ?? []).map((e) => e.organization_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs } = await db
      .from("organizations")
      .select("id, name")
      .in("id", orgIds as string[]);
    for (const o of orgs ?? []) names.set(o.id, o.name);
  }

  return {
    failed: (failed ?? []).map((e) => ({
      id: e.id,
      orgName: e.organization_id ? names.get(e.organization_id) ?? null : null,
      type: e.type,
      eventId: e.event_id,
      attempts: e.attempts,
      lastStatus: e.last_status,
      lastError: e.last_error,
      createdAt: e.created_at,
    })),
    pending: pendingCount.count ?? 0,
    sent: sentCount.count ?? 0,
  };
}
