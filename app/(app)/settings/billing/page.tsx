import { redirect } from "next/navigation";

import { BillingSection } from "@/components/settings/billing-section";
import { requireAppContext } from "@/lib/auth/session";
import { getSubscription, isBillingEnabled } from "@/lib/billing/service";

export default async function SettingsBillingPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") redirect("/settings");

  const subscription = await getSubscription();
  return (
    <BillingSection
      currentPlan={subscription?.plan ?? "free"}
      status={subscription?.status ?? "active"}
      enabled={isBillingEnabled()}
    />
  );
}
