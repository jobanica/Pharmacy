"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  updateCollectionDetails,
  uploadCollectionQr,
  removeCollectionQr,
} from "@/lib/admin/actions";
import type { CollectionDetails } from "@/lib/billing/collection";

/**
 * Where subscribers send their activation and monthly payments. Shown to a
 * referred pharmacy on its billing page once the agreement is signed, so
 * "pay by bank transfer" actually says where to.
 */
export function CollectionSettings({ details }: { details: CollectionDetails }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({
    gcash: { ...details.gcash },
    maya: { ...details.maya },
    bank: { ...details.bank },
    note: details.note,
  });

  function save() {
    start(async () => {
      const res = await updateCollectionDetails(form);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Payment details saved");
        router.refresh();
      }
    });
  }

  function pickQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("Image too large (max 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      start(async () => {
        const res = await uploadCollectionQr(String(reader.result));
        if ("error" in res) toast.error(res.error);
        else {
          toast.success("QR uploaded");
          router.refresh();
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function dropQr() {
    start(async () => {
      const res = await removeCollectionQr();
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("QR removed");
        router.refresh();
      }
    });
  }

  const methods = [
    { key: "gcash" as const, label: "GCash" },
    { key: "maya" as const, label: "Maya" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="size-4" />
          Where subscribers pay you
        </CardTitle>
        <CardDescription>
          Shown to a pharmacy on its billing page once it has signed the service
          agreement, next to the receipt form. This is money coming in to you —
          not a pharmacy&apos;s own storefront QR.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-2">
          <Label>Payment QR</Label>
          {details.qrUrl ? (
            <div className="flex items-start gap-4">
              <Image
                src={details.qrUrl}
                alt="Payment QR"
                width={160}
                height={160}
                unoptimized
                className="rounded-lg border bg-white p-2"
              />
              <Button variant="outline" size="sm" disabled={pending} onClick={dropQr}>
                <Trash2 className="size-4" />
                Remove
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No QR uploaded yet. Subscribers will only see the account numbers below.
            </p>
          )}
          <Input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            disabled={pending}
            onChange={pickQr}
          />
          <p className="text-xs text-muted-foreground">PNG, JPEG or SVG, under 2 MB.</p>
        </div>

        {methods.map(({ key, label }) => (
          <div key={key} className="grid gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form[key].enabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: { ...f[key], enabled: e.target.checked } }))
                }
              />
              {label}
            </label>
            {form[key].enabled ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Account name"
                  value={form[key].name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: { ...f[key], name: e.target.value } }))
                  }
                />
                <Input
                  placeholder="Mobile number"
                  value={form[key].number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: { ...f[key], number: e.target.value } }))
                  }
                />
              </div>
            ) : null}
          </div>
        ))}

        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.bank.enabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, bank: { ...f.bank, enabled: e.target.checked } }))
              }
            />
            Bank transfer
          </label>
          {form.bank.enabled ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Bank name"
                value={form.bank.bankName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank: { ...f.bank, bankName: e.target.value } }))
                }
              />
              <Input
                placeholder="Account name"
                value={form.bank.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank: { ...f.bank, name: e.target.value } }))
                }
              />
              <Input
                placeholder="Account number"
                value={form.bank.number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bank: { ...f.bank, number: e.target.value } }))
                }
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="note">Note shown to subscribers (optional)</Label>
          <Input
            id="note"
            placeholder="e.g. Put your pharmacy name in the message"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>

        <Button className="w-fit" disabled={pending} onClick={save}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save payment details
        </Button>
      </CardContent>
    </Card>
  );
}
