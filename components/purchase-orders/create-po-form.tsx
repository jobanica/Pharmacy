"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, TriangleAlert } from "lucide-react";
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
type LowStockItem = {
  product_id: string;
  product_name: string;
  unit: string;
  on_hand: number;
  reorder_point: number;
  deficit: number;
};
type Line = { productId: string; quantityOrdered: string; unitCost: string };

export function CreatePoForm({
  products,
  suppliers,
  lowStock = [],
}: {
  products: Product[];
  suppliers: Supplier[];
  lowStock?: LowStockItem[];
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

  // Add a suggested low-stock item as a line (qty = how many short). Drops the
  // pristine empty starter line so the list stays tidy.
  function addSuggestion(item: LowStockItem) {
    setLines((prev) => {
      const cleaned = prev.filter(
        (l) => !(l.productId === "" && l.quantityOrdered === "1" && l.unitCost === ""),
      );
      return [
        ...cleaned,
        {
          productId: item.product_id,
          quantityOrdered: String(Math.max(item.deficit, 1)),
          unitCost: "",
        },
      ];
    });
  }

  // Low-stock items not yet on the order.
  const addedIds = new Set(lines.map((l) => l.productId).filter(Boolean));
  const suggestions = lowStock.filter((s) => !addedIds.has(s.product_id));

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

        {lowStock.length > 0 ? (
          <div className="grid gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-500">
              <TriangleAlert className="size-4" />
              Low in inventory ({suggestions.length} to reorder)
            </div>
            {suggestions.length > 0 ? (
              <div className="grid gap-1.5">
                {suggestions.map((s) => (
                  <div
                    key={s.product_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{s.product_name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.on_hand} on hand · reorder at {s.reorder_point} · short{" "}
                        {Math.max(s.deficit, 1)} {s.unit}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSuggestion(s)}
                    >
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                All low-stock items have been added to this order.
              </p>
            )}
          </div>
        ) : null}

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
