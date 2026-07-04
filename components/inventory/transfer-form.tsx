"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTransfer } from "@/lib/transfers/actions";

type Branch = { id: string; name: string };
type Product = { id: string; name: string; unit: string; on_hand: number };
type Line = { productId: string; quantity: number };

/** Searchable product picker — type to filter, click to select. */
function ProductCombobox({
  products,
  value,
  onChange,
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    return list.slice(0, 50);
  }, [products, query]);

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        type="text"
        value={open ? query : selected?.name ?? ""}
        placeholder="Search product…"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-primary"
      />
      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No products found</div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent ${
                  p.id === value ? "bg-accent/50 font-medium" : ""
                }`}
              >
                {p.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {p.on_hand} {p.unit}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TransferForm({
  branches,
  products,
}: {
  branches: Branch[];
  products: Product[];
}) {
  const router = useRouter();
  const [toBranchId, setToBranchId] = React.useState(branches[0]?.id ?? "");
  const [lines, setLines] = React.useState<Line[]>([{ productId: "", quantity: 1 }]);
  const [notes, setNotes] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function addLine() {
    setLines((prev) => [...prev, { productId: "", quantity: 1 }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i));
  }

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    const valid = lines.filter((l) => l.productId && l.quantity > 0);
    if (!toBranchId) { toast.error("Select a destination branch"); return; }
    if (valid.length === 0) { toast.error("Add at least one item"); return; }

    startTransition(async () => {
      const res = await createTransfer(toBranchId, valid, notes);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Transfer created and dispatched");
      router.push(`/inventory/transfers/${res.transferId}`);
    });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Label htmlFor="to-branch" className="w-36 shrink-0">Destination branch</Label>
        <select
          id="to-branch"
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={toBranchId}
          onChange={(e) => setToBranchId(e.target.value)}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">On hand</th>
              <th className="px-3 py-2 text-right">Qty to transfer</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const prod = productMap.get(l.productId);
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">
                    <ProductCombobox
                      products={products}
                      value={l.productId}
                      onChange={(id) => setLine(i, { productId: id })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {prod ? `${prod.on_hand} ${prod.unit}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min={1}
                      max={prod?.on_hand}
                      value={l.quantity || ""}
                      onChange={(e) => setLine(i, { quantity: parseInt(e.target.value) || 0 })}
                      className="h-7 w-24 text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    {lines.length > 1 ? (
                      <button type="button" onClick={() => removeLine(i)} className="rounded p-1 hover:bg-muted">
                        <Trash2 className="size-3 text-muted-foreground" />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t px-3 py-2">
          <button type="button" onClick={addLine} className="inline-flex items-center gap-1 text-xs text-primary underline">
            <Plus className="size-3" /> Add item
          </button>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Label htmlFor="notes" className="w-36 shrink-0 pt-2 text-sm">Notes</Label>
        <textarea
          id="notes"
          rows={2}
          placeholder="Optional notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
        />
      </div>

      <Button onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
        Dispatch transfer
      </Button>
    </div>
  );
}
