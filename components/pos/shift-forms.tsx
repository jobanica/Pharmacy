"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openShift, closeShift } from "@/lib/shifts/actions";

export function OpenShiftForm() {
  const [cash, setCash] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    startTransition(async () => {
      const res = await openShift(cash);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Shift opened");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label htmlFor="opening-cash" className="w-36 shrink-0">Opening cash (₱)</Label>
        <Input
          id="opening-cash"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          className="w-36"
        />
      </div>
      <Button onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Open shift
      </Button>
    </div>
  );
}

export function CloseShiftForm({ shiftId }: { shiftId: string }) {
  const [cash, setCash] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    startTransition(async () => {
      const res = await closeShift(shiftId, cash, notes);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Shift closed");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label htmlFor="closing-cash" className="w-36 shrink-0">Closing cash count (₱)</Label>
        <Input
          id="closing-cash"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={cash}
          onChange={(e) => setCash(e.target.value)}
          className="w-36"
        />
      </div>
      <div className="flex items-start gap-3">
        <Label htmlFor="shift-notes" className="w-36 shrink-0 pt-2">Notes</Label>
        <textarea
          id="shift-notes"
          rows={2}
          placeholder="Optional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>
      <Button variant="destructive" onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Close shift
      </Button>
    </div>
  );
}
