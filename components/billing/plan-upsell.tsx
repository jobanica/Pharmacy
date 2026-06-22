import { Lock } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PlanUpsell({
  title,
  description,
  requiredPlan = "Starter",
}: {
  title: string;
  description: string;
  requiredPlan?: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Lock className="size-6 text-muted-foreground" />
        </div>
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
        <p className="text-sm font-medium text-primary">Requires the {requiredPlan} plan</p>
        <Button render={<Link href="/settings?tab=billing" />}>Upgrade now</Button>
      </CardContent>
    </Card>
  );
}
