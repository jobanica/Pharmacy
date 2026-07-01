"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCount, approveStocktake } from "@/lib/stocktakes/actions";

type Item = {
  id: string;
  productId: string;
  name: string;
  unit: string;
  systemQty: number;
  countedQty: number | null;
};

export function StocktakeSheet({
  stocktakeId,
  items,
  canApprove,
  approved,
}: {
  stocktakeId: string;
  items: Item[];
  canApprove: boolean;
  approved: boolean;
}) {
  const [counts, setCounts] = React.useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const it of items) {
      if (it.countedQty != null) m[it.id] = String(it.countedQty);
    }
    return m;
  });
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [approvePending, startApprove] = React.useTransition();
  const [query, setQuery] = React.useState("");
  const [onlyUncounted, setOnlyUncounted] = React.useState(false);

  function isCounted(id: string) {
    return counts[id] != null && counts[id] !== "";
  }

  const visibleItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (onlyUncounted && isCounted(it.id)) return false;
      if (q && !it.name.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query, onlyUncounted, counts]);

  async function onBlur(id: string) {
    const val = counts[id];
    if (val === "" || val == null) return;
    const n = parseInt(val);
    if (isNaN(n) || n < 0) return;
    setSaving((s) => ({ ...s, [id]: true }));
    const res = await saveCount(id, n);
    setSaving((s) => ({ ...s, [id]: false }));
    if ("error" in res) toast.error(res.error);
  }

  function approve() {
    startApprove(async () => {
      const res = await approveStocktake(stocktakeId);
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Stocktake approved — adjustments applied");
    });
  }

  const countedCount = items.filter((i) => counts[i.id] != null && counts[i.id] !== "").length;
  const varianceItems = items.filter((i) => {
    const c = counts[i.id];
    return c != null && c !== "" && parseInt(c) !== i.systemQty;
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {countedCount} of {items.length} items counted
        {varianceItems.length > 0 ? ` · ${varianceItems.length} variance${varianceItems.length > 1 ? "s" : ""}` : ""}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search product…"
            className="h-9 pl-8"
          />
        </div>
        <Button
          type="button"
          variant={onlyUncounted ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyUncounted((v) => !v)}
        >
          {onlyUncounted ? "Showing uncounted" : "Only uncounted"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">System qty</th>
              <th className="px-3 py-2 text-right">Counted qty</th>
              <th className="px-3 py-2 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  {onlyUncounted ? "Everything visible has been counted." : "No products match your search."}
                </td>
              </tr>
            ) : null}
            {visibleItems.map((it) => {
              const raw = counts[it.id];
              const counted = raw != null && raw !== "" ? parseInt(raw) : null;
              const variance = counted != null ? counted - it.systemQty : null;
              const isSaving = saving[it.id];
              return (
                <tr
                  key={it.id}
                  className={`border-t ${variance != null && variance !== 0 ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
                >
                  <td className="px-3 py-2">
                    {it.name}
                    <span className="ml-1 text-xs text-muted-foreground">{it.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{it.systemQty}</td>
                  <td className="px-3 py-2 text-right">
                    {approved ? (
                      <span>{counted ?? "—"}</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        {isSaving ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
                        <Input
                          type="number"
                          min={0}
                          value={raw ?? ""}
                          onChange={(e) => setCounts((s) => ({ ...s, [it.id]: e.target.value }))}
                          onBlur={() => onBlur(it.id)}
                          placeholder="—"
                          className="h-7 w-20 text-right"
                        />
                      </div>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${
                    variance == null ? "text-muted-foreground" :
                    variance > 0 ? "text-emerald-600" :
                    variance < 0 ? "text-destructive" : ""
                  }`}>
                    {variance == null ? "—" : variance === 0 ? "✓" : `${variance > 0 ? "+" : ""}${variance}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!approved && canApprove ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Approving will apply adjustments to inventory for all counted items with variances.
            Uncounted items are unchanged.
          </p>
          <Button
            variant="destructive"
            onClick={approve}
            disabled={countedCount === 0 || approvePending}
          >
            {approvePending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Approve &amp; apply adjustments
          </Button>
        </div>
      ) : null}
    </div>
  );
}
