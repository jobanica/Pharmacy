"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, type Plan, type PlanId } from "@/lib/billing/plans";
import { startTrial, startCheckout, cancelSubscription } from "@/lib/billing/actions";
import { formatCentavos } from "@/lib/money";

function daysLeft(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function BillingSection({
  plans = PLANS,
  currentPlan,
  status,
  trialEndsAt,
  enabled,
}: {
  plans?: Plan[];
  currentPlan: string;
  status: string;
  trialEndsAt: string | null;
  enabled: boolean;
}) {
  const [pending, start] = React.useTransition();
  const isTrialing = status === "trialing" && trialEndsAt != null;
  const trialDaysLeft = isTrialing ? daysLeft(trialEndsAt!) : 0;
  const trialExpired = isTrialing && trialDaysLeft <= 0;

  function trial(plan: PlanId) {
    start(async () => {
      const res = await startTrial(plan);
      if (res?.error) toast.error(res.error);
    });
  }

  function pay(plan: PlanId) {
    start(async () => {
      const res = await startCheckout(plan);
      if (res?.error) toast.error(res.error);
    });
  }

  function cancel() {
    start(async () => {
      const res = await cancelSubscription();
      if (res?.error) toast.error(res.error);
      else toast.success("Subscription cancelled");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Billing
          <Badge variant="outline">{isTrialing ? "trialing" : status}</Badge>
        </CardTitle>
        <CardDescription>
          {isTrialing && !trialExpired ? (
            <span className="text-emerald-400 font-medium">
              🎉 Free trial active — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining.
              You won&apos;t be charged until the trial ends.
            </span>
          ) : trialExpired ? (
            <span className="text-amber-400 font-medium">
              ⚠️ Your free trial has ended. Add a payment method to keep your plan features.
            </span>
          ) : enabled ? (
            "Manage your subscription. Payments are processed by Xendit."
          ) : (
            "Billing is disabled in this environment — core features are never gated. Enable it with NEXT_PUBLIC_BILLING_ENABLED + a Xendit key."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const canTrial = !isTrialing && plan.priceCentavos > 0 && !isCurrent;
          const needsToPay = isCurrent && (trialExpired || (isTrialing && enabled));

          return (
            <div
              key={plan.id}
              className={`flex flex-col rounded-xl border p-4 ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{plan.name}</span>
                {isCurrent ? <Sparkles className="size-4 text-primary" /> : null}
              </div>
              <div className="mt-1 text-2xl font-bold">
                {plan.priceCentavos === 0 ? "Free" : formatCentavos(plan.priceCentavos)}
                {plan.priceCentavos > 0 ? (
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                ) : null}
              </div>
              {plan.priceCentavos > 0 && !isCurrent ? (
                <p className="mt-0.5 text-xs font-medium text-emerald-400">14 days free trial</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
              <ul className="mt-3 grid flex-1 gap-1.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-2">
                {isCurrent && !trialExpired && !isTrialing ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : isCurrent && isTrialing && !trialExpired ? (
                  <>
                    <Button variant="outline" className="w-full" disabled>
                      Trialing
                    </Button>
                    {enabled ? (
                      <Button className="w-full" disabled={pending} onClick={() => pay(plan.id)}>
                        Pay now
                      </Button>
                    ) : null}
                  </>
                ) : isCurrent && trialExpired ? (
                  <Button
                    className="w-full"
                    disabled={!enabled || pending}
                    onClick={() => pay(plan.id)}
                  >
                    {enabled ? "Add payment method" : "Trial ended"}
                  </Button>
                ) : plan.priceCentavos === 0 ? (
                  <Button variant="outline" className="w-full" disabled>
                    {isCurrent ? "Current plan" : "Included"}
                  </Button>
                ) : canTrial ? (
                  <Button className="w-full" disabled={pending} onClick={() => trial(plan.id)}>
                    Start free trial
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={!enabled || pending}
                    onClick={() => pay(plan.id)}
                  >
                    {enabled ? "Choose plan" : "Unavailable in dev"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
      {enabled && currentPlan !== "free" && status === "active" ? (
        <CardContent className="pt-0">
          <Button variant="outline" className="text-destructive" disabled={pending} onClick={cancel}>
            Cancel subscription
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
