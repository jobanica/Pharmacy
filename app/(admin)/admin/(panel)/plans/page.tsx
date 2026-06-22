import { Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { PLANS } from "@/lib/billing/plans";
import { formatCentavos } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requirePlatformAdmin();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Plans</h1>
        <p className="text-sm text-muted-foreground">Available subscription tiers.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <Card key={plan.id} className="relative overflow-hidden">
            {plan.id === "pro" && (
              <div className="absolute right-3 top-3">
                <Badge className="bg-violet-600 text-white">Top tier</Badge>
              </div>
            )}
            <CardHeader className="pb-2">
              <CardTitle className="capitalize">{plan.name}</CardTitle>
              <div className="text-2xl font-bold">
                {plan.priceCentavos === 0 ? (
                  "Free"
                ) : (
                  <>
                    {formatCentavos(plan.priceCentavos)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
