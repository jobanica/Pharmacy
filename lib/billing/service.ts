import "server-only";

import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export type SubscriptionRow = {
  plan: string;
  status: string;
  current_period_end: string | null;
  xendit_subscription_id: string | null;
};

export function isBillingEnabled(): boolean {
  return publicEnv.NEXT_PUBLIC_BILLING_ENABLED;
}

/** The current org's subscription (owner-scoped by RLS). Null if none. */
export async function getSubscription(): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, xendit_subscription_id")
    .maybeSingle();
  return data ?? null;
}
