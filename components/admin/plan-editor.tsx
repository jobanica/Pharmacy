"use client";

import * as React from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updatePlan } from "@/lib/admin/actions";
import type { Plan } from "@/lib/billing/plans";

export function PlanEditor({ plan }: { plan: Plan }) {
  const [name, setName] = React.useState(plan.name);
  // Edit the price in pesos; convert to/from centavos at the boundary.
  const [price, setPrice] = React.useState((plan.priceCentavos / 100).toString());
  const [description, setDescription] = React.useState(plan.description);
  const [features, setFeatures] = React.useState(plan.features.join("\n"));
  const [pending, start] = React.useTransition();

  function save() {
    const pesos = Number(price);
    if (!Number.isFinite(pesos) || pesos < 0) {
      toast.error("Enter a valid price");
      return;
    }
    start(async () => {
      const res = await updatePlan({
        id: plan.id,
        name: name.trim(),
        priceCentavos: Math.round(pesos * 100),
        description: description.trim(),
        features: features
          .split("\n")
          .map((f) => f.trim())
          .filter(Boolean),
      });
      if ("error" in res) toast.error(res.error);
      else toast.success(`${name.trim()} plan saved`);
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="capitalize">{plan.id}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`name-${plan.id}`}>Name</Label>
          <Input
            id={`name-${plan.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`price-${plan.id}`}>Price (₱ / month)</Label>
          <Input
            id={`price-${plan.id}`}
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Enter 0 for a free plan.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`desc-${plan.id}`}>Description</Label>
          <Input
            id={`desc-${plan.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`features-${plan.id}`}>Features (one per line)</Label>
          <textarea
            id={`features-${plan.id}`}
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            rows={7}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
