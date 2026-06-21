"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Upload, Loader2, Trash2 } from "lucide-react";
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
import { scanReceipt, importReceipt, type ScannedLine } from "@/lib/ai/actions";

type Option = { id: string; name: string };

const NEW = "__new__";

type EditableLine = {
  key: string;
  productId: string; // existing product id, or NEW
  newProductName: string;
  newGenericName: string;
  quantity: string;
  unitCost: string;
  expiryDate: string;
  batchNumber: string;
};

let lineCounter = 0;
function toEditable(line: ScannedLine): EditableLine {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    productId: line.matchProductId ?? NEW,
    newProductName: line.productName,
    newGenericName: line.genericName ?? "",
    quantity: String(line.quantity || 1),
    unitCost: line.unitCost ? String(line.unitCost) : "0",
    expiryDate: line.expiryDate ?? "",
    batchNumber: line.batchNumber ?? "",
  };
}

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

export function ScanReceiptDialog({
  suppliers,
  products,
  aiEnabled,
  branchName,
  trigger,
}: {
  suppliers: Option[];
  products: Option[];
  aiEnabled: boolean;
  branchName: string;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [importing, startImport] = React.useTransition();

  const [lines, setLines] = React.useState<EditableLine[]>([]);
  const [reviewing, setReviewing] = React.useState(false);
  const [supplierId, setSupplierId] = React.useState<string>(NEW);
  const [newSupplierName, setNewSupplierName] = React.useState("");

  const fileRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setLines([]);
    setReviewing(false);
    setSupplierId(NEW);
    setNewSupplierName("");
    setScanning(false);
    if (fileRef.current) fileRef.current.value = "";
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
        setScanning(false);
        return;
      }
      if (res.lines.length === 0) {
        toast.error("No product lines found on that receipt.");
        setScanning(false);
        return;
      }
      setLines(res.lines.map(toEditable));
      if (res.matchSupplierId) {
        setSupplierId(res.matchSupplierId);
      } else {
        setSupplierId(NEW);
        setNewSupplierName(res.supplierName ?? "");
      }
      setReviewing(true);
      setScanning(false);
      toast.success(`Found ${res.lines.length} item(s) — review and confirm.`);
    } catch {
      toast.error("Couldn't process that image.");
      setScanning(false);
    }
  }

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function onConfirm() {
    startImport(async () => {
      const res = await importReceipt({
        supplierId: supplierId === NEW ? "" : supplierId,
        newSupplierName: supplierId === NEW ? newSupplierName : "",
        lines: lines.map((l) => ({
          productId: l.productId === NEW ? "" : l.productId,
          newProductName: l.productId === NEW ? l.newProductName : "",
          newGenericName: l.productId === NEW ? l.newGenericName : "",
          quantity: l.quantity,
          unitCost: l.unitCost,
          expiryDate: l.expiryDate,
          batchNumber: l.batchNumber,
        })),
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Received ${res.received} item(s) into ${branchName}.`);
      setOpen(false);
      reset();
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-violet-500" />
            Scan receipt
          </DialogTitle>
          <DialogDescription>
            Snap or upload a supplier delivery receipt. AI reads the products,
            quantities, costs, expiry, and supplier — then receives them into{" "}
            {branchName}.
          </DialogDescription>
        </DialogHeader>

        {!aiEnabled ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto mb-2 size-6 text-muted-foreground" />
            AI receipt scanning isn&apos;t configured yet. Add an{" "}
            <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code> to
            your environment to turn it on.
          </div>
        ) : !reviewing ? (
          <div className="grid gap-4 py-2">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-muted/40">
              {scanning ? (
                <>
                  <Loader2 className="size-6 animate-spin text-violet-500" />
                  Reading the receipt…
                </>
              ) : (
                <>
                  <Upload className="size-6" />
                  <span className="font-medium text-foreground">
                    Tap to take a photo or upload
                  </span>
                  <span>JPEG, PNG, or WebP — a clear, well-lit shot works best.</span>
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
          </div>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Supplier</Label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value={NEW}>+ New supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {supplierId === NEW ? (
                <Input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Supplier name (optional)"
                />
              ) : null}
            </div>

            <div className="grid gap-3">
              {lines.map((l) => (
                <div key={l.key} className="rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-2">
                      <select
                        value={l.productId}
                        onChange={(e) => updateLine(l.key, { productId: e.target.value })}
                        className="h-9 rounded-md border bg-transparent px-3 text-sm"
                      >
                        <option value={NEW}>+ Create new product</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {l.productId === NEW ? (
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={l.newProductName}
                            onChange={(e) => updateLine(l.key, { newProductName: e.target.value })}
                            placeholder="New product name"
                          />
                          <Input
                            value={l.newGenericName}
                            onChange={(e) => updateLine(l.key, { newGenericName: e.target.value })}
                            placeholder="Generic name (optional)"
                          />
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeLine(l.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="grid gap-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={l.quantity}
                        onChange={(e) => updateLine(l.key, { quantity: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Unit cost (₱)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.unitCost}
                        onChange={(e) => updateLine(l.key, { unitCost: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Expiry</Label>
                      <Input
                        type="date"
                        value={l.expiryDate}
                        onChange={(e) => updateLine(l.key, { expiryDate: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs">Batch #</Label>
                      <Input
                        value={l.batchNumber}
                        onChange={(e) => updateLine(l.key, { batchNumber: e.target.value })}
                        placeholder="optional"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {lines.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  All lines removed. Re-scan to start over.
                </p>
              ) : null}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={reset}
                disabled={importing}
              >
                Re-scan
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={importing || lines.length === 0}
              >
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Receive {lines.length} item(s)
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
