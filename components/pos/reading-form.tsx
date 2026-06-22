"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { closeReading } from "@/lib/pos/reading-actions";
import { formatManila } from "@/lib/date";

export function ReadingForm({ lastZAt }: { lastZAt: string | null }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [openingCash, setOpeningCash] = React.useState("");

  function submit(type: "x" | "z") {
    start(async () => {
      const res = await closeReading({
        type,
        openingCash: openingCash ? Number(openingCash) * 100 : 0,
        openedAt: lastZAt ?? undefined,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        toast.success(type === "x" ? "X-reading saved" : "Z-reading closed");
        window.print();
        router.refresh();
      }
    });
  }

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Close reading</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {lastZAt ? (
          <p className="text-xs text-muted-foreground">
            Period: {formatManila(lastZAt)} → now
          </p>
        ) : null}

        <div className="grid gap-2">
          <Label>Opening cash (₱)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" disabled={pending} onClick={() => submit("x")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
            Print X-reading
          </Button>
          <Button disabled={pending} onClick={() => submit("z")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Close day (Z)
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Z-reading is permanent and non-resettable. Print and file per BIR regulations.
        </p>
      </CardContent>
    </Card>
  );
}
