"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setRegisterReadingEnabled } from "@/lib/organization/actions";

export function FeatureToggles({
  registerReading,
  canEdit,
}: {
  registerReading: boolean;
  canEdit: boolean;
}) {
  const [on, setOn] = React.useState(registerReading);
  const [pending, start] = React.useTransition();

  function toggle(next: boolean) {
    setOn(next); // optimistic
    start(async () => {
      const res = await setRegisterReadingEnabled(next);
      if ("error" in res) {
        setOn(!next);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Register Reading enabled" : "Register Reading hidden");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Features</CardTitle>
        <CardDescription>Turn optional modules on or off for your pharmacy.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <Label htmlFor="register-reading" className="text-sm font-medium">
              Register Reading
            </Label>
            <p className="text-xs text-muted-foreground">
              Show the X/Z register reading page in the menu. When off, it&apos;s hidden.
            </p>
          </div>
          <Switch
            id="register-reading"
            checked={on}
            onCheckedChange={toggle}
            disabled={!canEdit || pending}
          />
        </div>
      </CardContent>
    </Card>
  );
}
