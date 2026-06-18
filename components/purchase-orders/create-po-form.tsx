"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPurchaseOrder } from "@/lib/purchase-orders/actions";
import { formatCentavos, pesosToCentavos } from "@/lib/money";

type Product = { id: string; name: string };
type Supplier = { id: string; name: string };
type Line = { productId: string; quantityOrdered: string; unitCost: string };

export function CreatePoForm({
  products,
  suppliers,
}: {
  products: Product[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([
    { productId: "", quantityOrdered: "1", unitCost: "" },
  ]);
  const [pending, startTransition] = React.useTransition();

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantityOrdered: "1", unitCost: "" }]);
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const estTotal = lines.reduce((s, l) => {
    const qty = Number(l.quantityOrdered) || 0;
    const cost = l.unitCost ? pesosToCentavos(l.unitCost) : 0;
    return s + qty * cost;
  }, 0);

  function submit() {
    const items = lines.filter((l) => l.productId);
    if (items.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    startTransition(async () => {
      const res = await createPurchaseOrder({
        supplierId,
        expectedDate,
        notes,
        items: items.map((l) => ({
          productId: l.productId,
          quantityOrdered: l.quantityOrdered,
          unitCost: l.unitCost || "0",
        })),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Purchase order created");
      router.push(`/purchase-orders/${res.id}`);
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Supplier</Label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">— select later —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Expected date</Label>
            <Input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Items</Label>
          <div className="grid gap-2">
            {lines.map((l, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <select
                  value={l.productId}
                  onChange={(e) => updateLine(i, { productId: e.target.value })}
                  className="h-9 min-w-[180px] flex-1 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">Select product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Qty</span>
                  <Input
                    type="number"
                    min="1"
                    value={l.quantityOrdered}
                    onChange={(e) => updateLine(i, { quantityOrdered: e.target.value })}
                    className="w-20"
                  />
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Unit cost ₱</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={l.unitCost}
                    onChange={(e) => updateLine(i, { unitCost: e.target.value })}
                    className="w-28"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => removeLine(i)}
                  disabled={lines.length === 1}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-fit" onClick={addLine}>
            <Plus className="size-4" />
            Add line
          </Button>
        </div>

        <div className="grid gap-2">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-sm text-muted-foreground">
            Estimated total: <strong>{formatCentavos(estTotal)}</strong>
          </span>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create draft PO
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
