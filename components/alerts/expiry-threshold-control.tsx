"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateExpiryAlertDays } from "@/lib/alerts/actions";

export function ExpiryThresholdControl({ days, canEdit }: { days: number; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(String(days));
  const [pending, start] = React.useTransition();

  function save() {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < 1 || n > 730) {
      toast.error("Enter a number of days between 1 and 730");
      return;
    }
    start(async () => {
      const res = await updateExpiryAlertDays(n);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(`Alerting on stock expiring within ${n} days`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm print:hidden">
      <CalendarClock className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">Alert me for stock expiring within</span>
      {canEdit ? (
        <>
          <Input
            type="number"
            min="1"
            max="730"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8 w-20"
            disabled={pending}
          />
          <span className="text-muted-foreground">days</span>
          <Button size="sm" onClick={save} disabled={pending || value === String(days)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </>
      ) : (
        <span className="font-medium">{days} days</span>
      )}
    </div>
  );
}
