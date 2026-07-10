"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getProductBatches, writeOffStock, type BatchOption } from "@/lib/inventory/actions";
import { formatCentavos, centavosToPesos } from "@/lib/money";

type Product = { id: string; name: string };

export function WriteOffDialog({ products, trigger }: { products: Product[]; trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [showList, setShowList] = React.useState(false);
  const [productId, setProductId] = React.useState("");
  const [batches, setBatches] = React.useState<BatchOption[]>([]);
  const [batchId, setBatchId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [reason, setReason] = React.useState<"expired" | "damaged" | "other">("expired");
  const [notes, setNotes] = React.useState("");
  const [loadingBatches, setLoadingBatches] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedBatch = batches.find((b) => b.id === batchId);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products).slice(0, 30);
  }, [products, query]);

  function reset() {
    setQuery("");
    setProductId("");
    setBatches([]);
    setBatchId("");
    setQty("");
    setReason("expired");
    setNotes("");
  }

  async function pickProduct(p: Product) {
    setProductId(p.id);
    setQuery(p.name);
    setShowList(false);
    setBatchId("");
    setLoadingBatches(true);
    const b = await getProductBatches(p.id);
    setBatches(b);
    setLoadingBatches(false);
    if (b.length === 1) setBatchId(b[0].id);
  }

  const estCost = selectedBatch ? (Number(qty) || 0) * selectedBatch.cost_centavos : 0;

  function submit() {
    if (!batchId) {
      toast.error("Select a batch");
      return;
    }
    if (!(Number(qty) > 0)) {
      toast.error("Enter a quantity");
      return;
    }
    setPending(true);
    writeOffStock(batchId, qty, reason, notes).then((res) => {
      setPending(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Wrote off ${qty} — cost ${formatCentavos(res.totalCostCentavos)}`);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="size-5" />
            Record stock adjustment
          </DialogTitle>
          <DialogDescription>
            Write off expired or damaged stock. The cost is recorded so you can track losses.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label>Product</Label>
            <div className="relative">
              <Input
                value={query}
                placeholder="Search product…"
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowList(true);
                  setProductId("");
                }}
                onFocus={() => setShowList(true)}
              />
              {showList && matches.length > 0 && !productId ? (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-lg">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pickProduct(p)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {selectedProduct ? (
            <div className="grid gap-1.5">
              <Label>Batch</Label>
              {loadingBatches ? (
                <span className="text-sm text-muted-foreground">Loading batches…</span>
              ) : batches.length === 0 ? (
                <span className="text-sm text-muted-foreground">No stock on hand for this product.</span>
              ) : (
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">Select batch…</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.batch_number ?? "no batch#"} · exp {b.expiry_date ?? "—"} · {b.quantity} on hand ·{" "}
                      {formatCentavos(b.cost_centavos)}/unit
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                max={selectedBatch?.quantity}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Reason</Label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as "expired" | "damaged" | "other")}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="expired">Expired</option>
                <option value="damaged">Damaged</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. water damage" />
          </div>

          {selectedBatch && Number(qty) > 0 ? (
            <p className="text-sm">
              Cost of this write-off:{" "}
              <span className="font-semibold text-destructive">{formatCentavos(estCost)}</span>
              <span className="text-muted-foreground">
                {" "}
                ({qty} × {centavosToPesos(selectedBatch.cost_centavos).toFixed(2)})
              </span>
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending || !batchId || !(Number(qty) > 0)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Write off stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
