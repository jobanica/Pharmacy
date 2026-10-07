import { redirect } from "next/navigation";

import { BillingSection } from "@/components/settings/billing-section";
import { PortalPayments } from "@/components/settings/portal-payments";
import { requireAppContext } from "@/lib/auth/session";
import { getSubscription, isBillingEnabled } from "@/lib/billing/service";
import { getPlans } from "@/lib/billing/get-plans";
import { getManualPayments, getPortalAccount } from "@/lib/portal/service";
import { coverageEnd } from "@/lib/agent-kit/billing";

export default async function SettingsBillingPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") redirect("/settings");

  const subscription = await getSubscription();
  const plans = await getPlans();
  // Pro was merged into the single ₱800 plan; show a legacy 'pro' org as being
  // on Starter so the all-access plan reads as their current plan.
  const rawPlan = subscription?.plan ?? "free";
  const currentPlan = rawPlan === "pro" ? "starter" : rawPlan;

  // The agreement + receipt flow belongs to pharmacies that signed up through
  // an agent. An account with no agent code sees exactly what it saw before.
  const account = await getPortalAccount();
  const payments = account?.agentCode ? await getManualPayments() : [];
  const paidUntil = coverageEnd(
    payments
      .filter((p) => p.type === "monthly" && p.status === "confirmed" && p.billing_month_start)
      .map((p) => ({
        billingMonthStart: new Date(p.billing_month_start!),
        monthsCovered: p.months_covered,
      })),
  );

  return (
    <div className="grid gap-6">
      <BillingSection
        plans={plans}
        currentPlan={currentPlan}
        status={subscription?.status ?? "active"}
        trialEndsAt={subscription?.trial_ends_at ?? null}
        enabled={await isBillingEnabled()}
      />
      {account?.agentCode ? (
        <PortalPayments
          contractStatus={account.contractStatus}
          minimumTermEndsAt={account.minimumTermEndsAt}
          payments={payments}
          activationPaid={payments.some(
            (p) =>
              p.type === "activation" &&
              (p.status === "submitted" || p.status === "confirmed"),
          )}
          paidUntil={paidUntil?.toISOString() ?? null}
        />
      ) : null}
    </div>
  );
}
