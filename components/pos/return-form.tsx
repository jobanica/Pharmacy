"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCentavos } from "@/lib/money";
import { processReturn } from "@/lib/returns/actions";

type ReturnLine = {
  productId: string;
  name: string;
  unit: string;
  unitPrice: number;
  maxQty: number;
  returnQty: number;
};

export function ReturnForm({
  saleId,
  lines,
}: {
  saleId: string;
  lines: Omit<ReturnLine, "returnQty">[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<ReturnLine[]>(
    lines.map((l) => ({ ...l, returnQty: 0 })),
  );
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function setQty(productId: string, value: string) {
    setItems((prev) =>
      prev.map((l) =>
        l.productId === productId
          ? { ...l, returnQty: Math.min(Math.max(parseInt(value) || 0, 0), l.maxQty) }
          : l,
      ),
    );
  }

  const returnTotal = items.reduce((s, l) => s + l.unitPrice * l.returnQty, 0);
  const hasItems = items.some((l) => l.returnQty > 0);

  function submit() {
    if (!hasItems) { toast.error("Select at least one item to return"); return; }
    startTransition(async () => {
      const res = await processReturn(
        saleId,
        items.filter((l) => l.returnQty > 0).map((l) => ({ productId: l.productId, quantity: l.returnQty })),
        reason,
      );
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Return processed");
      router.push(`/pos/returns/${res.returnId}`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Unit price</th>
              <th className="px-3 py-2 text-right">Sold qty</th>
              <th className="px-3 py-2 text-right">Return qty</th>
              <th className="px-3 py-2 text-right">Refund</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l) => (
              <tr key={l.productId} className="border-t">
                <td className="px-3 py-2">
                  {l.name}
                  <span className="ml-1 text-xs text-muted-foreground">{l.unit}</span>
                </td>
                <td className="px-3 py-2 text-right">{formatCentavos(l.unitPrice)}</td>
                <td className="px-3 py-2 text-right">{l.maxQty}</td>
                <td className="px-3 py-2 text-right">
                  <Input
                    type="number"
                    min={0}
                    max={l.maxQty}
                    value={l.returnQty || ""}
                    onChange={(e) => setQty(l.productId, e.target.value)}
                    className="h-7 w-20 text-right"
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {l.returnQty > 0 ? formatCentavos(l.unitPrice * l.returnQty) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right font-semibold">Total refund</td>
              <td className="px-3 py-2 text-right font-semibold">{formatCentavos(returnTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-start gap-3">
        <Label htmlFor="reason" className="w-24 shrink-0 pt-2 text-sm">Reason</Label>
        <textarea
          id="reason"
          rows={2}
          placeholder="Defective product, wrong item, customer changed mind..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <Button onClick={submit} disabled={!hasItems || pending}>
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Process return — refund {formatCentavos(returnTotal)}
      </Button>
    </div>
  );
}
