import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getPlatformBillingConfig } from "@/lib/billing/platform-config";

export type SubscriptionRow = {
  plan: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  xendit_subscription_id: string | null;
};

export async function isBillingEnabled(): Promise<boolean> {
  const cfg = await getPlatformBillingConfig();
  return cfg.enabled && cfg.secretKey !== null;
}

/** The current org's subscription (owner-scoped by RLS). Null if none. */
export async function getSubscription(): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, trial_ends_at, xendit_subscription_id")
    .maybeSingle();
  return data ?? null;
}
