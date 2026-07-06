"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Send, Ban, PackageCheck, Undo2, Loader2 } from "lucide-react";
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
import {
  updatePoHeader,
  addPoItem,
  removePoItem,
  setPoStatus,
  receivePurchaseOrder,
  reversePoReceiving,
} from "@/lib/purchase-orders/actions";
import { formatCentavos } from "@/lib/money";

type Supplier = { id: string; name: string };
type Product = { id: string; name: string };

export function HeaderEditor({
  poId,
  suppliers,
  supplierId,
  expectedDate,
  notes,
}: {
  poId: string;
  suppliers: Supplier[];
  supplierId: string;
  expectedDate: string;
  notes: string;
}) {
  const router = useRouter();
  const [s, setS] = React.useState(supplierId);
  const [d, setD] = React.useState(expectedDate);
  const [n, setN] = React.useState(notes);
  const [pending, start] = React.useTransition();

  function save() {
    start(async () => {
      const res = await updatePoHeader(poId, { supplierId: s, expectedDate: d, notes: n });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Saved");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="grid gap-1">
        <Label className="text-xs">Supplier</Label>
        <select
          value={s}
          onChange={(e) => setS(e.target.value)}
          className="h-9 rounded-md border bg-transparent px-3 text-sm"
        >
          <option value="">— none —</option>
          {suppliers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Expected date</Label>
        <Input type="date" value={d} onChange={(e) => setD(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Notes</Label>
        <div className="flex gap-2">
          <Input value={n} onChange={(e) => setN(e.target.value)} placeholder="optional" />
          <Button variant="outline" onClick={save} disabled={pending}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ReverseReceivingButton({ poId }: { poId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  function reverse() {
    if (
      !window.confirm(
        "Reverse ALL stock received for this purchase order? Use this if the wrong receipt was scanned.\n\nThe received quantities are removed from inventory and the PO goes back to “sent” so it can be received again. This can't be undone.",
      )
    ) {
      return;
    }
    start(async () => {
      const res = await reversePoReceiving(poId);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(`Reversed ${res.reversedUnits} unit(s). You can receive again.`);
        router.refresh();
      }
    });
  }
  return (
    <Button variant="outline" className="text-destructive" onClick={reverse} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />}
      Reverse receiving
    </Button>
  );
}

export function AddItemForm({ poId, products }: { poId: string; products: Product[] }) {
  const router = useRouter();
  const [productId, setProductId] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [cost, setCost] = React.useState("");
  const [pending, start] = React.useTransition();

  function add() {
    if (!productId) {
      toast.error("Select a product");
      return;
    }
    start(async () => {
      const res = await addPoItem(poId, {
        productId,
        quantityOrdered: qty,
        unitCost: cost || "0",
      });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Item added");
        setProductId("");
        setQty("1");
        setCost("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <select
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
        className="h-9 min-w-[180px] flex-1 rounded-md border bg-transparent px-3 text-sm"
      >
        <option value="">Add product…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="w-20" placeholder="Qty" />
      <Input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="w-28" placeholder="Cost ₱" />
      <Button variant="outline" onClick={add} disabled={pending}>
        <Plus className="size-4" />
        Add
      </Button>
    </div>
  );
}

export function RemoveItemButton({ itemId, poId }: { itemId: string; poId: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-destructive"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await removePoItem(itemId, poId);
          if ("error" in res) toast.error(res.error);
          else router.refresh();
        })
      }
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

export function StatusButton({
  poId,
  to,
}: {
  poId: string;
  to: "sent" | "cancelled";
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const isCancel = to === "cancelled";
  function go() {
    if (isCancel && !window.confirm("Cancel this purchase order?")) return;
    start(async () => {
      const res = await setPoStatus(poId, to);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(isCancel ? "Purchase order cancelled" : "Marked as sent");
        router.refresh();
      }
    });
  }
  return (
    <Button variant={isCancel ? "outline" : "default"} className={isCancel ? "text-destructive" : ""} onClick={go} disabled={pending}>
      {isCancel ? <Ban className="size-4" /> : <Send className="size-4" />}
      {isCancel ? "Cancel" : "Mark as sent"}
    </Button>
  );
}

type ReceiveItem = {
  id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_centavos: number;
};

export function ReceiveDialog({ poId, items }: { poId: string; items: ReceiveItem[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [lines, setLines] = React.useState(() =>
    items.map((it) => ({
      itemId: it.id,
      name: it.product_name,
      cost: it.unit_cost_centavos,
      outstanding: Math.max(it.quantity_ordered - it.quantity_received, 0),
      qty: String(Math.max(it.quantity_ordered - it.quantity_received, 0)),
      batch: "",
      expiry: "",
    })),
  );

  function update(i: number, patch: Partial<(typeof lines)[number]>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit() {
    start(async () => {
      const res = await receivePurchaseOrder(poId, {
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantityReceived: l.qty,
          batchNumber: l.batch,
          expiryDate: l.expiry,
        })),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Stock received into inventory");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <PackageCheck className="size-4" />
            Receive
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive purchase order</DialogTitle>
          <DialogDescription>
            Enter received quantity, batch number, and expiry per item. This
            creates stock batches at the PO&apos;s branch.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {lines.map((l, i) => (
            <div key={l.itemId} className="grid gap-2 rounded-lg border p-3">
              <div className="text-sm font-medium">
                {l.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {l.outstanding} outstanding · {formatCentavos(l.cost)}/unit cost
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs">Received</Label>
                  <Input type="number" min="0" value={l.qty} onChange={(e) => update(i, { qty: e.target.value })} className="w-24" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Batch #</Label>
                  <Input value={l.batch} onChange={(e) => update(i, { batch: e.target.value })} className="w-28" placeholder="optional" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Expiry</Label>
                  <Input type="date" value={l.expiry} onChange={(e) => update(i, { expiry: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            Confirm receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
