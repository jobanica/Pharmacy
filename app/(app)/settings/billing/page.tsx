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
  return (
    <BillingSection
      plans={plans}
      currentPlan={subscription?.plan ?? "free"}
      status={subscription?.status ?? "active"}
      enabled={await isBillingEnabled()}
    />
  );
}
