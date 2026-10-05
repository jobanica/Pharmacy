import { redirect } from "next/navigation";

import { BillingSection } from "@/components/settings/billing-section";
import { requireAppContext } from "@/lib/auth/session";
import { getSubscription, isBillingEnabled } from "@/lib/billing/service";
import { getPlans } from "@/lib/billing/get-plans";

export default async function SettingsBillingPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") redirect("/settings");

  const subscription = await getSubscription();
  const plans = await getPlans();
  // Pro was merged into the single ₱800 plan; show a legacy 'pro' org as being
  // on Starter so the all-access plan reads as their current plan.
  const rawPlan = subscription?.plan ?? "free";
  const currentPlan = rawPlan === "pro" ? "starter" : rawPlan;
  return (
    <BillingSection
      plans={plans}
      currentPlan={currentPlan}
      status={subscription?.status ?? "active"}
      trialEndsAt={subscription?.trial_ends_at ?? null}
      enabled={await isBillingEnabled()}
    />
  );
}
