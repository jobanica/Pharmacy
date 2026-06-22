"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTaxSettings } from "@/lib/tax/actions";
import type { TaxSettings } from "@/lib/tax/settings";

export function TaxSettingsCard({ tax }: { tax: TaxSettings }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({
    tin: tax.tin,
    businessAddress: tax.businessAddress,
    accreditationNo: tax.accreditationNo,
    permitNo: tax.permitNo,
    atpNo: tax.atpNo,
    vatRatePct: String(tax.vatRatePct),
    orPrefix: tax.orPrefix,
    orPadding: String(tax.orPadding),
  });

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function save() {
    start(async () => {
      const res = await saveTaxSettings({
        tin: form.tin,
        businessAddress: form.businessAddress,
        accreditationNo: form.accreditationNo,
        permitNo: form.permitNo,
        atpNo: form.atpNo,
        vatRatePct: form.vatRatePct,
        orPrefix: form.orPrefix,
        orPadding: form.orPadding,
      });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Tax & receipt settings saved");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax &amp; Official Receipts</CardTitle>
        <CardDescription>
          BIR registration details printed on every receipt. CAS accreditation required before
          receipts are legally valid Official Receipts.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>TIN</Label>
            <Input value={form.tin} onChange={field("tin")} placeholder="000-000-000-000" maxLength={20} />
          </div>
          <div className="grid gap-2">
            <Label>Business address</Label>
            <Input value={form.businessAddress} onChange={field("businessAddress")} placeholder="Street, City, Province" />
          </div>
          <div className="grid gap-2">
            <Label>BIR accreditation no.</Label>
            <Input value={form.accreditationNo} onChange={field("accreditationNo")} placeholder="e.g. 0000-00000000-00" />
          </div>
          <div className="grid gap-2">
            <Label>Permit no.</Label>
            <Input value={form.permitNo} onChange={field("permitNo")} placeholder="Annual registration permit" />
          </div>
          <div className="grid gap-2">
            <Label>ATP no. (Authority to Print)</Label>
            <Input value={form.atpNo} onChange={field("atpNo")} placeholder="From BIR Form 1906" />
          </div>
          <div className="grid gap-2">
            <Label>VAT rate (%)</Label>
            <Input value={form.vatRatePct} onChange={field("vatRatePct")} type="number" min={0} max={100} step={0.01} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>OR prefix</Label>
            <Input value={form.orPrefix} onChange={field("orPrefix")} placeholder="OR" maxLength={20} />
            <p className="text-xs text-muted-foreground">e.g. "OR" → OR-0000001</p>
          </div>
          <div className="grid gap-2">
            <Label>OR number digits</Label>
            <Input value={form.orPadding} onChange={field("orPadding")} type="number" min={4} max={10} />
            <p className="text-xs text-muted-foreground">Minimum 4, default 7</p>
          </div>
        </div>

        <Button onClick={save} disabled={pending} className="w-fit">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Save tax settings
        </Button>
      </CardContent>
    </Card>
  );
}
