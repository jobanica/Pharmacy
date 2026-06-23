import "server-only";

/**
 * Resolved billing configuration for the platform.
 *
 * Source of truth is the `platform_settings` row, editable by super-admins from
 * /admin/payments. Environment variables (XENDIT_SECRET_KEY, XENDIT_WEBHOOK_TOKEN,
 * NEXT_PUBLIC_BILLING_ENABLED) act only as a fallback so existing deployments keep
 * working. The secret key and webhook token are read with the service-role client
 * and must never be sent to the browser.
 */
import { createServiceClient } from "@/lib/supabase/service";
import { publicEnv, serverEnv } from "@/lib/env";

export type PlatformBillingConfig = {
  enabled: boolean;
  secretKey: string | null;
  webhookToken: string | null;
};

const nonEmpty = (v: string | null | undefined): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

export async function getPlatformBillingConfig(): Promise<PlatformBillingConfig> {
  const env = serverEnv();
  let row: {
    xendit_secret_key: string | null;
    xendit_webhook_token: string | null;
    billing_enabled: boolean;
  } | null = null;

  try {
    const db = createServiceClient();
    const { data } = await db
      .from("platform_settings")
      .select("xendit_secret_key, xendit_webhook_token, billing_enabled")
      .maybeSingle();
    row = data ?? null;
  } catch {
    // Table missing or unreachable — fall back to env entirely.
  }

  return {
    enabled: row?.billing_enabled ?? publicEnv.NEXT_PUBLIC_BILLING_ENABLED,
    secretKey: nonEmpty(row?.xendit_secret_key) ?? nonEmpty(env.XENDIT_SECRET_KEY),
    webhookToken:
      nonEmpty(row?.xendit_webhook_token) ?? nonEmpty(env.XENDIT_WEBHOOK_TOKEN),
  };
}

/** Non-secret status for the admin UI — never exposes the actual keys. */
export type PlatformBillingStatus = {
  enabled: boolean;
  hasSecretKey: boolean;
  hasWebhookToken: boolean;
};

export async function getPlatformBillingStatus(): Promise<PlatformBillingStatus> {
  const cfg = await getPlatformBillingConfig();
  return {
    enabled: cfg.enabled,
    hasSecretKey: cfg.secretKey !== null,
    hasWebhookToken: cfg.webhookToken !== null,
  };
}
