"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, Loader2, Check, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scanReceipt } from "@/lib/ai/actions";
import { receivePoItem, updatePoItemCost, addAndReceivePoItem } from "@/lib/purchase-orders/actions";
import { formatCentavos, centavosToPesos } from "@/lib/money";

type ExtraLine = {
  key: string;
  productName: string;
  matchProductId: string | null;
  qty: string;
  cost: string;
  batch: string;
  expiry: string;
  added: boolean;
};

export type ReceiveItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_centavos: number;
};

type LineState = {
  qty: string;
  batch: string;
  expiry: string;
  cost: string;
  added: boolean;
  matched: boolean;
};

/** Downscale a photo client-side so the upload stays small and within API limits. */
async function fileToResizedDataUrl(file: File, maxDim = 1600): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load the image"));
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1 && dataUrl.length < 4_000_000) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function ScanReceiveDialog({
  poId,
  items,
  aiEnabled,
}: {
  poId: string;
  items: ReceiveItem[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [extras, setExtras] = React.useState<ExtraLine[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [lines, setLines] = React.useState<Record<string, LineState>>(() =>
    Object.fromEntries(
      items.map((it) => [
        it.id,
        {
          qty: String(Math.max(it.quantity_ordered - it.quantity_received, 0)),
          batch: "",
          expiry: "",
          cost: it.unit_cost_centavos ? String(centavosToPesos(it.unit_cost_centavos)) : "",
          added: false,
          matched: false,
        },
      ]),
    ),
  );

  function update(id: string, patch: Partial<LineState>) {
    setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      const res = await scanReceipt(dataUrl);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      // Match each scanned line to a PO item by product id, then by name.
      const leftover: ExtraLine[] = [];
      const patches: Record<string, Partial<LineState>> = {};
      for (const sl of res.lines) {
        const byId = sl.matchProductId
          ? items.find((it) => it.product_id === sl.matchProductId)
          : undefined;
        const byName =
          byId ??
          items.find((it) => {
            const a = norm(it.product_name);
            const b = norm(sl.productName);
            return a === b || a.includes(b) || b.includes(a);
          });
        if (!byName) {
          // On the delivery but not on this PO — offer to add it anyway.
          leftover.push({
            key: `extra-${leftover.length}-${sl.productName}`,
            productName: sl.productName,
            matchProductId: sl.matchProductId,
            qty: sl.quantity > 0 ? String(sl.quantity) : "1",
            cost: sl.unitCost > 0 ? String(sl.unitCost) : "",
            batch: sl.batchNumber ?? "",
            expiry: sl.expiryDate ?? "",
            added: false,
          });
          continue;
        }
        patches[byName.id] = {
          qty: sl.quantity > 0 ? String(sl.quantity) : patches[byName.id]?.qty ?? lines[byName.id]?.qty,
          batch: sl.batchNumber ?? "",
          expiry: sl.expiryDate ?? "",
          ...(sl.unitCost > 0 ? { cost: String(sl.unitCost) } : {}),
          matched: true,
        };
      }
      setLines((prev) => {
        const next = { ...prev };
        for (const [id, p] of Object.entries(patches)) next[id] = { ...next[id], ...p };
        return next;
      });
      setExtras(leftover);
      const matchedCount = Object.keys(patches).length;
      toast.success(
        `Matched ${matchedCount} PO item(s)${leftover.length ? `, ${leftover.length} extra not on the PO` : ""} — review and add.`,
      );
    } catch {
      toast.error("Couldn't process that image.");
    } finally {
      setScanning(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // Receive one line: apply a cost change (if any) then create the batch.
  async function receiveOne(it: ReceiveItem, ln: LineState): Promise<boolean> {
    if (!(Number(ln.qty) > 0)) return false;
    const origCost = it.unit_cost_centavos ? String(centavosToPesos(it.unit_cost_centavos)) : "";
    if (ln.cost.trim() !== "" && ln.cost.trim() !== origCost) {
      const costRes = await updatePoItemCost(it.id, poId, ln.cost);
      if ("error" in costRes) {
        toast.error(costRes.error);
        return false;
      }
    }
    const res = await receivePoItem(it.id, poId, {
      quantityReceived: ln.qty,
      batchNumber: ln.batch,
      expiryDate: ln.expiry,
    });
    if ("error" in res) {
      toast.error(res.error);
      return false;
    }
    update(it.id, { added: true });
    return true;
  }

  function add(it: ReceiveItem) {
    setSavingId(it.id);
    receiveOne(it, lines[it.id]).then((ok) => {
      setSavingId(null);
      if (ok) {
        toast.success(`Added ${it.product_name} to inventory`);
        router.refresh();
      }
    });
  }

  async function addAllMatched() {
    const pending = items.filter((it) => lines[it.id].matched && !lines[it.id].added);
    if (pending.length === 0) {
      toast.error("No matched items left to add.");
      return;
    }
    setSavingId("__all__");
    let count = 0;
    for (const it of pending) {
      // Read latest state in case the user edited a field mid-run.
      const ln = lines[it.id];
      // eslint-disable-next-line no-await-in-loop
      if (await receiveOne(it, ln)) count += 1;
    }
    setSavingId(null);
    if (count > 0) {
      toast.success(`Added ${count} item(s) to inventory`);
      router.refresh();
    }
  }

  function updateExtra(key: string, patch: Partial<ExtraLine>) {
    setExtras((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  }

  function addExtra(ex: ExtraLine) {
    if (!(Number(ex.qty) > 0)) {
      toast.error("Enter a quantity");
      return;
    }
    setSavingId(ex.key);
    addAndReceivePoItem(poId, {
      productId: ex.matchProductId ?? "",
      newProductName: ex.matchProductId ? "" : ex.productName,
      quantityReceived: ex.qty,
      unitCost: ex.cost || "0",
      batchNumber: ex.batch,
      expiryDate: ex.expiry,
    }).then((res) => {
      setSavingId(null);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      updateExtra(ex.key, { added: true });
      toast.success(`Added ${ex.productName} to inventory`);
      router.refresh();
    });
  }

  const matchedPending = items.filter((it) => lines[it.id].matched && !lines[it.id].added).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Sparkles className="size-4" />
            Scan &amp; receive
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-500" />
            Scan receipt &amp; receive items
          </DialogTitle>
          <DialogDescription>
            Upload the supplier receipt to auto-fill batch numbers, expiry dates,
            and quantities, then add each item to inventory one by one.
          </DialogDescription>
        </DialogHeader>

        {aiEnabled ? (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/40">
            {scanning ? (
              <>
                <Loader2 className="size-5 animate-spin text-violet-500" />
                Reading the receipt…
              </>
            ) : (
              <>
                <Upload className="size-5" />
                <span className="font-medium text-foreground">Scan / upload receipt</span>
                <span>(optional — you can also fill items in manually)</span>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={scanning}
              onChange={onFile}
            />
          </label>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            AI receipt scanning isn&apos;t configured — fill in batch and expiry per
            item below, then add each to inventory.
          </div>
        )}

        <div className="grid gap-3">
          {items.map((it) => {
            const ln = lines[it.id];
            const outstanding = Math.max(it.quantity_ordered - it.quantity_received, 0);
            return (
              <div
                key={it.id}
                className={
                  "rounded-lg border p-3 " +
                  (ln.added ? "border-emerald-500/50 bg-emerald-500/5" : ln.matched ? "border-violet-500/40" : "")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {it.product_name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {outstanding} outstanding · {formatCentavos(it.unit_cost_centavos)}/unit
                    </span>
                  </div>
                  {ln.added ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-500">
                      <Check className="size-4" />
                      Received
                    </span>
                  ) : null}
                </div>

                {!ln.added ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="grid gap-1">
                      <Label className="text-xs">Qty received</Label>
                      <Input
                        type="number"
                        min="1"
                        value={ln.qty}
                        onChange={(e) => update(it.id, { qty: e.target.value })}
                        className="w-24"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Batch #</Label>
                      <Input
                        value={ln.batch}
                        onChange={(e) => update(it.id, { batch: e.target.value })}
                        className="w-32"
                        placeholder="optional"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Expiry</Label>
                      <Input
                        type="date"
                        value={ln.expiry}
                        onChange={(e) => update(it.id, { expiry: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">
                        Unit cost ₱
                        {ln.matched &&
                        ln.cost.trim() !== "" &&
                        ln.cost.trim() !==
                          (it.unit_cost_centavos ? String(centavosToPesos(it.unit_cost_centavos)) : "") ? (
                          <span className="ml-1 text-amber-600 dark:text-amber-500">(from receipt)</span>
                        ) : null}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ln.cost}
                        onChange={(e) => update(it.id, { cost: e.target.value })}
                        className="w-28"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => add(it)}
                      disabled={savingId !== null || !(Number(ln.qty) > 0)}
                    >
                      {savingId === it.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      Add
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {matchedPending > 0 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={addAllMatched}
            disabled={savingId !== null}
            className="w-full"
          >
            {savingId === "__all__" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Add all matched ({matchedPending})
          </Button>
        ) : null}

        {extras.length > 0 ? (
          <div className="grid gap-2">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
              Extra items on the receipt (not on this PO)
            </p>
            <p className="text-xs text-muted-foreground">
              Add them to receive the stock too — they&apos;ll be attributed to this PO&apos;s supplier.
            </p>
            {extras.map((ex) => (
              <div
                key={ex.key}
                className={
                  "rounded-lg border p-3 " +
                  (ex.added ? "border-emerald-500/50 bg-emerald-500/5" : "border-amber-500/40")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">
                    {ex.productName}
                    {ex.matchProductId ? null : (
                      <span className="ml-2 text-xs text-muted-foreground">(new product)</span>
                    )}
                  </div>
                  {ex.added ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-500">
                      <Check className="size-4" />
                      Received
                    </span>
                  ) : null}
                </div>
                {!ex.added ? (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div className="grid gap-1">
                      <Label className="text-xs">Qty received</Label>
                      <Input
                        type="number"
                        min="1"
                        value={ex.qty}
                        onChange={(e) => updateExtra(ex.key, { qty: e.target.value })}
                        className="w-24"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Batch #</Label>
                      <Input
                        value={ex.batch}
                        onChange={(e) => updateExtra(ex.key, { batch: e.target.value })}
                        className="w-32"
                        placeholder="optional"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Expiry</Label>
                      <Input
                        type="date"
                        value={ex.expiry}
                        onChange={(e) => updateExtra(ex.key, { expiry: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Unit cost ₱</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={ex.cost}
                        onChange={(e) => updateExtra(ex.key, { cost: e.target.value })}
                        className="w-28"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => addExtra(ex)}
                      disabled={savingId !== null || !(Number(ex.qty) > 0)}
                    >
                      {savingId === ex.key ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                      Add
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
