"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Upload, Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  updateStorefront,
  uploadStorefrontQr,
  removeStorefrontQr,
} from "@/lib/storefront/actions";
import type { Storefront } from "@/lib/storefront/settings";

export function StorefrontSettings({ initial }: { initial: Storefront }) {
  const [deliveryFee, setDeliveryFee] = React.useState(
    initial.deliveryFeeCentavos ? (initial.deliveryFeeCentavos / 100).toString() : "",
  );
  const [gcash, setGcash] = React.useState(initial.gcash);
  const [maya, setMaya] = React.useState(initial.maya);
  const [bank, setBank] = React.useState(initial.bank);
  const [qrUrl, setQrUrl] = React.useState(initial.qrUrl);
  const [pending, start] = React.useTransition();
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function save() {
    start(async () => {
      const res = await updateStorefront({
        deliveryFee,
        gcash,
        maya,
        bank: { enabled: bank.enabled, name: bank.name, number: bank.number, bankName: bank.bankName },
      });
      if ("error" in res) toast.error(res.error);
      else toast.success("Storefront settings saved");
    });
  }

  async function onQrFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const res = await uploadStorefrontQr(dataUrl);
      if ("error" in res) toast.error(res.error);
      else {
        setQrUrl(dataUrl);
        toast.success("QR uploaded");
      }
    } catch {
      toast.error("Couldn't upload that image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function onRemoveQr() {
    start(async () => {
      const res = await removeStorefrontQr();
      if ("error" in res) toast.error(res.error);
      else {
        setQrUrl(null);
        toast.success("QR removed");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Fee added to online orders set for delivery.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid max-w-xs gap-2">
            <Label htmlFor="delivery-fee">Delivery fee (₱)</Label>
            <Input
              id="delivery-fee"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Online payment methods</CardTitle>
          <CardDescription>
            Shown to customers who choose to pay online. Fill in the accounts you accept.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <MethodBlock
            title="GCash"
            method={gcash}
            onChange={setGcash}
            numberLabel="GCash number"
          />
          <MethodBlock title="Maya" method={maya} onChange={setMaya} numberLabel="Maya number" />

          <div className="grid gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Bank transfer</Label>
              <Switch
                checked={bank.enabled}
                onCheckedChange={(v) => setBank((b) => ({ ...b, enabled: v }))}
              />
            </div>
            {bank.enabled ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Bank name"
                  value={bank.bankName}
                  onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))}
                />
                <Input
                  placeholder="Account name"
                  value={bank.name}
                  onChange={(e) => setBank((b) => ({ ...b, name: e.target.value }))}
                />
                <Input
                  placeholder="Account number"
                  value={bank.number}
                  onChange={(e) => setBank((b) => ({ ...b, number: e.target.value }))}
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-2 rounded-lg border p-3">
            <Label className="text-sm font-medium">Payment QR (optional)</Label>
            <p className="text-xs text-muted-foreground">
              A single QR image customers can scan to pay (GCash/Maya/bank QR).
            </p>
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Payment QR" className="h-40 w-40 rounded-md border object-contain" />
            ) : null}
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onQrFile} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {qrUrl ? "Replace QR" : "Upload QR"}
              </Button>
              {qrUrl ? (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemoveQr} disabled={pending}>
                  <Trash2 className="size-4" /> Remove
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save settings
        </Button>
      </div>
    </div>
  );
}

function MethodBlock({
  title,
  method,
  onChange,
  numberLabel,
}: {
  title: string;
  method: { enabled: boolean; name: string; number: string };
  onChange: (m: { enabled: boolean; name: string; number: string }) => void;
  numberLabel: string;
}) {
  return (
    <div className="grid gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{title}</Label>
        <Switch checked={method.enabled} onCheckedChange={(v) => onChange({ ...method, enabled: v })} />
      </div>
      {method.enabled ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Account name"
            value={method.name}
            onChange={(e) => onChange({ ...method, name: e.target.value })}
          />
          <Input
            placeholder={numberLabel}
            value={method.number}
            onChange={(e) => onChange({ ...method, number: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
