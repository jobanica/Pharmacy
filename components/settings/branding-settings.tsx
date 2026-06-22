"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { updateBranding, uploadLogo, removeLogo } from "@/lib/branding/actions";
import { PAPER_WIDTHS } from "@/lib/branding";

type Paper = "58mm" | "80mm" | "A4";

export function BrandingSettings({
  appName,
  brandName,
  logoUrl,
  header,
  footer,
  paper,
  autoPrint,
}: {
  appName: string;
  brandName: string;
  logoUrl: string | null;
  header: string;
  footer: string;
  paper: Paper;
  autoPrint: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({
    brandName: brandName === appName ? "" : brandName,
    header,
    footer,
    paper,
    autoPrint,
  });
  const fileRef = React.useRef<HTMLInputElement>(null);

  function save() {
    start(async () => {
      const res = await updateBranding({
        brandName: form.brandName,
        receiptHeader: form.header,
        receiptFooter: form.footer,
        paper: form.paper,
        autoPrint: form.autoPrint,
      });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Branding saved");
        router.refresh();
      }
    });
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      start(async () => {
        const res = await uploadLogo(String(reader.result));
        if ("error" in res) toast.error(res.error);
        else {
          toast.success("Logo updated");
          router.refresh();
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    start(async () => {
      const res = await removeLogo();
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Logo removed");
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Branding &amp; receipts</CardTitle>
        <CardDescription>
          White-label the app and receipts with your pharmacy&apos;s name and logo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Brand name</Label>
            <Input
              value={form.brandName}
              onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
              placeholder={appName}
            />
            <p className="text-xs text-muted-foreground">
              Shown in the sidebar and on receipts. Leave blank to use “{appName}”.
            </p>
          </div>
          <div className="grid gap-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo" className="size-12 rounded-lg bg-white object-contain p-1" />
              ) : (
                <div className="flex size-12 items-center justify-center rounded-lg bg-white/5 text-[10px] text-muted-foreground">
                  none
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={pending}>
                <Upload className="size-4" />
                Upload
              </Button>
              {logoUrl ? (
                <Button variant="ghost" size="sm" className="text-destructive" onClick={clearLogo} disabled={pending}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Receipt header</Label>
            <Textarea
              rows={2}
              value={form.header}
              onChange={(e) => setForm((f) => ({ ...f, header: e.target.value }))}
              placeholder="Address, TIN, contact number…"
            />
          </div>
          <div className="grid gap-2">
            <Label>Receipt footer</Label>
            <Textarea
              rows={2}
              value={form.footer}
              onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
              placeholder="Thank you message…"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="grid gap-2">
            <Label>Paper width</Label>
            <select
              value={form.paper}
              onChange={(e) => setForm((f) => ({ ...f, paper: e.target.value as Paper }))}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="58mm">58mm (thermal)</option>
              <option value="80mm">80mm (thermal)</option>
              <option value="A4">A4 (full page)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={form.autoPrint}
              onCheckedChange={(v) => setForm((f) => ({ ...f, autoPrint: v }))}
            />
            Auto-print receipt after a sale
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save branding
          </Button>
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" />
            Test print
          </Button>
          <span className="text-xs text-muted-foreground">
            Sends a sample receipt to your printer to check the connection and paper size.
          </span>
        </div>
      </CardContent>

      {/* Hidden on screen; the only thing that prints (see globals.css @media print). */}
      <div className={`print-area hidden print:block ${PAPER_WIDTHS[form.paper]} mx-auto p-2`}>
        <div className="text-center">
          <div className="text-lg font-bold">{form.brandName.trim() || appName}</div>
          {form.header.trim() ? (
            <div className="whitespace-pre-line text-xs">{form.header}</div>
          ) : null}
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center text-xs font-semibold">*** TEST PRINT ***</div>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex justify-between"><span>1× Sample item A</span><span>₱25.00</span></div>
          <div className="flex justify-between"><span>2× Sample item B</span><span>₱40.00</span></div>
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between text-sm font-bold">
          <span>TOTAL</span>
          <span>₱65.00</span>
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center text-xs">
          Printer connected successfully.
          <br />
          {new Date().toLocaleString("en-PH")}
        </div>
        {form.footer.trim() ? (
          <div className="mt-2 whitespace-pre-line text-center text-xs">{form.footer}</div>
        ) : null}
      </div>
    </Card>
  );
}
