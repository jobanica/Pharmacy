"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateLoyaltySettings } from "@/lib/loyalty/actions";

export function LoyaltySettings({ pesoPerPoint }: { pesoPerPoint: number }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [value, setValue] = React.useState(String(pesoPerPoint));

  function save() {
    start(async () => {
      const res = await updateLoyaltySettings({ pesoPerPoint: value });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Loyalty settings saved");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loyalty &amp; rewards</CardTitle>
        <CardDescription>
          Set how much a customer must spend to earn one point. Points are still
          worth ₱1 each when redeemed.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2 sm:max-w-sm">
          <Label htmlFor="peso-per-point">Pesos per point</Label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">₱</span>
            <Input
              id="peso-per-point"
              type="number"
              min="1"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="max-w-28"
            />
            <span className="text-muted-foreground">= 1 point</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Example: at ₱{value || "20"} per point, a ₱
            {(Number(value) || 20) * 10} purchase earns 10 points.
          </p>
        </div>

        <div>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save loyalty settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
