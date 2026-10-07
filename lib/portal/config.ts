import "server-only";

import { configFromEnv, type AgentPortalConfig } from "@/lib/agent-kit";

/**
 * The agent portal's configuration for this deployment.
 *
 * Null when any of AGENT_PORTAL_URL / AGENT_PORTAL_PRODUCT_SLUG /
 * AGENT_PORTAL_SECRET is missing. Null is a working state, not an error: the
 * app keeps queueing events in product_event_outbox and simply sends nothing
 * until the three variables are set, at which point the worker catches up.
 *
 * Deliberately not routed through lib/env.ts: `serverEnv()` throws when a
 * variable is missing, and a missing portal secret must never take down a
 * signup or the billing page.
 */
export function portalConfig(): AgentPortalConfig | null {
  return configFromEnv(process.env);
}

/** Whether the portal is wired up at all. */
export function portalConfigured(): boolean {
  return portalConfig() !== null;
}

/**
 * The absolute URL to register with the portal as this product's callback.
 * Built from the request host so a preview deployment registers its own URL
 * rather than production's.
 */
export function callbackUrl(host: string, proto = "https"): string {
  return `${proto}://${host}/api/portal/callback`;
}
