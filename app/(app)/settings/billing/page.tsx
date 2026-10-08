import { redirect } from "next/navigation";

import { BillingSection } from "@/components/settings/billing-section";
import { PortalPayments } from "@/components/settings/portal-payments";
import { requireAppContext } from "@/lib/auth/session";
import { getSubscription, isBillingEnabled } from "@/lib/billing/service";
import { getPlans } from "@/lib/billing/get-plans";
import { WhereToPay } from "@/components/settings/where-to-pay";
import { getManualPayments, getPortalAccount, getPortalFees } from "@/lib/portal/service";
import { getCollectionDetails, hasCollectionDetails } from "@/lib/billing/collection";
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
  const referred = Boolean(account?.agentCode);
  const [payments, collection, fees] = await Promise.all([
    referred ? getManualPayments() : Promise.resolve([]),
    referred ? getCollectionDetails() : Promise.resolve(null),
    // The portal knows the fees (they come from the commission rule this
    // customer signed up under). A portal that cannot be reached just means the
    // amount is not prefilled.
    referred ? getPortalFees(ctx.organization.id) : Promise.resolve(null),
  ]);
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
        (() => {
          const activationPaid = payments.some(
            (p) =>
              p.type === "activation" &&
              (p.status === "submitted" || p.status === "confirmed"),
          );
          return (
            <PortalPayments
              contractStatus={account.contractStatus}
              minimumTermEndsAt={account.minimumTermEndsAt}
              payments={payments}
              activationPaid={activationPaid}
              paidUntil={paidUntil?.toISOString() ?? null}
              activationCentavos={fees?.activationCentavos ?? null}
              monthlyCentavos={fees?.monthlyCentavos ?? null}
              whereToPay={
                collection && hasCollectionDetails(collection) ? (
                  <WhereToPay
                    details={collection}
                    label={activationPaid ? "monthly payment" : "activation fee"}
                    amountCentavos={
                      (activationPaid
                        ? fees?.monthlyCentavos
                        : fees?.activationCentavos) ?? null
                    }
                  />
                ) : null
              }
            />
          );
        })()
      ) : null}
    </div>
  );
}
