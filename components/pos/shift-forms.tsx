"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openShift, closeShift, type ShiftSummary, type CashDenomRow } from "@/lib/shifts/actions";
import { formatCentavos, centavosToPesos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import type { PrinterType } from "@/lib/branding";

// Philippine peso denominations (bills + coins), largest first, in centavos.
const DENOMINATIONS = [
  100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 100, 25,
] as const;

function denomLabel(centavos: number): string {
  return centavos >= 100 ? `₱${centavos / 100}` : `₱${(centavos / 100).toFixed(2)}`;
}

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

export function CloseShiftForm({
  shiftId,
  printerType = "browser",
}: {
  shiftId: string;
  printerType?: PrinterType;
}) {
  const [counts, setCounts] = React.useState<Record<number, string>>({});
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [summary, setSummary] = React.useState<ShiftSummary | null>(null);
  const printAreaRef = React.useRef<HTMLDivElement>(null);

  // Closing cash = sum of (denomination × count) entered in the breakdown.
  const closingCentavos = DENOMINATIONS.reduce(
    (sum, d) => sum + d * (parseInt(counts[d] || "0", 10) || 0),
    0,
  );
  const cashBreakdown: CashDenomRow[] = DENOMINATIONS.map((d) => ({
    denomCentavos: d,
    count: parseInt(counts[d] || "0", 10) || 0,
  })).filter((r) => r.count > 0);

  async function printSummary(s: ShiftSummary) {
    if (printerType === "bluetooth") {
      try {
        const [{ encodeShiftSummary }, { printViaBluetooth }] = await Promise.all([
          import("@/lib/escpos/shift-summary"),
          import("@/lib/escpos/bluetooth"),
        ]);
        await printViaBluetooth(encodeShiftSummary(s));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Bluetooth print failed";
        if (!/cancelled|user gesture|chooser/i.test(msg)) toast.error(msg);
      }
    } else {
      window.print();
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await closeShift(shiftId, centavosToPesos(closingCentavos).toFixed(2), notes);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Shift closed");
      // Attach the client-side denomination breakdown so it prints on the slip.
      const s: ShiftSummary = { ...res.data, cashBreakdown };
      setSummary(s);
      // Small delay to let the print area render before printing.
      setTimeout(() => printSummary(s), 500);
    });
  }

  if (summary) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Shift closed. Printing summary…</p>
        <Button variant="outline" size="sm" onClick={() => printSummary(summary)}>
          Print again
        </Button>
        {/* Print area — visible on screen for browser print; BT print uses ESC/POS */}
        <div ref={printAreaRef} className="shift-summary-print mx-auto max-w-xs rounded-lg border bg-white p-5 font-mono text-[13px] leading-relaxed text-black">
          <ShiftSummaryView summary={summary} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 block">Count the drawer (cash breakdown)</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {DENOMINATIONS.map((d) => (
            <div key={d} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <span className="w-12 shrink-0 text-sm text-muted-foreground">{denomLabel(d)}</span>
              <span className="text-muted-foreground">×</span>
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="0"
                value={counts[d] ?? ""}
                onChange={(e) => setCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                className="h-8 w-full"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Closing cash count</span>
          <span className="font-semibold">{formatCentavos(closingCentavos)}</span>
        </div>
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
        Close shift &amp; print summary
      </Button>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ShiftSummaryView({ summary: s }: { summary: ShiftSummary }) {
  const os = s.overShortCentavos;
  return (
    <>
      <div className="text-center">
        <div className="text-base font-bold">{s.storeName}</div>
        {s.branchName ? <div className="text-xs">{s.branchName}</div> : null}
        <div className="mt-1 text-xs font-semibold">*** SHIFT SUMMARY ***</div>
      </div>

      <div className="mt-3 border-t border-dashed pt-2 text-xs">
        <Row label="Cashier" value={s.cashierName} />
        <Row label="Opened" value={formatManila(s.openedAt)} />
        <Row label="Closed" value={formatManila(s.closedAt)} />
      </div>

      <div className="mt-2 border-t border-dashed pt-2 text-xs">
        <Row label="Transactions" value={String(s.salesCount)} />
        <Row label="Gross sales" value={formatCentavos(s.grossCentavos)} />
        <Row label="Discounts" value={`-${formatCentavos(s.discountCentavos)}`} />
        <Row label="Net sales" value={formatCentavos(s.netCentavos)} bold />
      </div>

      {s.paymentBreakdown && s.paymentBreakdown.length > 0 ? (
        <div className="mt-2 border-t border-dashed pt-2 text-xs">
          <div className="mb-1 font-semibold">By payment method</div>
          {s.paymentBreakdown.map((p) => (
            <Row key={p.method} label={p.label} value={formatCentavos(p.centavos)} />
          ))}
        </div>
      ) : null}

      <div className="mt-2 border-t border-dashed pt-2 text-xs">
        <Row label="Opening cash" value={formatCentavos(s.openingCashCentavos)} />
        <Row label="Cash collected" value={formatCentavos(s.cashCollectedCentavos)} />
        <Row label="Expected cash" value={formatCentavos(s.openingCashCentavos + s.cashCollectedCentavos)} />
        <Row label="Closing cash" value={formatCentavos(s.closingCashCentavos)} />
        <Row
          label="Over / Short"
          value={os === 0 ? "—" : `${os > 0 ? "+" : ""}${formatCentavos(Math.abs(os))}`}
          bold
        />
      </div>

      {s.cashBreakdown && s.cashBreakdown.length > 0 ? (
        <div className="mt-2 border-t border-dashed pt-2 text-xs">
          <div className="mb-1 font-semibold">Cash breakdown</div>
          {s.cashBreakdown.map((c) => (
            <Row
              key={c.denomCentavos}
              label={`${denomLabel(c.denomCentavos)} × ${c.count}`}
              value={formatCentavos(c.denomCentavos * c.count)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-2 border-t border-dashed pt-2 text-center text-xs text-gray-500">
        This is your shift closing record.
      </div>
    </>
  );
}
