"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { startCheckout, cancelSubscription } from "@/lib/billing/actions";
import { formatCentavos } from "@/lib/money";

export function BillingSection({
  currentPlan,
  status,
  enabled,
}: {
  currentPlan: string;
  status: string;
  enabled: boolean;
}) {
  const [pending, start] = React.useTransition();

  function choose(plan: PlanId) {
    start(async () => {
      const res = await startCheckout(plan);
      if (res?.error) toast.error(res.error);
      // On success the action redirects to Xendit checkout.
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
          <Badge variant="outline">{status}</Badge>
        </CardTitle>
        <CardDescription>
          {enabled
            ? "Manage your subscription. Payments are processed by Xendit."
            : "Billing is disabled in this environment — core features are never gated. Enable it with NEXT_PUBLIC_BILLING_ENABLED + a Xendit key."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
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
              <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
              <ul className="mt-3 grid flex-1 gap-1.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : plan.priceCentavos === 0 ? (
                  <Button variant="outline" className="w-full" disabled>
                    Included
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={!enabled || pending}
                    onClick={() => choose(plan.id)}
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
