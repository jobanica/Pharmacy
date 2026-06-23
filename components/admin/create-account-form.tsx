"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createAccount } from "@/lib/admin/actions";

export function CreateAccountForm() {
  const [pending, setPending] = React.useState(false);
  const [setupLink, setSetupLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [form, setForm] = React.useState({
    orgName: "",
    ownerName: "",
    plan: "free" as "free" | "starter" | "pro",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await createAccount(form);
    setPending(false);
    if ("error" in res) {
      toast.error(res.error);
    } else {
      toast.success("Account created — share the setup link with the pharmacy");
      setSetupLink(res.setupLink);
      setForm({ orgName: "", ownerName: "", plan: "free" });
    }
  }

  async function copyLink() {
    if (!setupLink) return;
    await navigator.clipboard.writeText(setupLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid gap-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New pharmacy account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="orgName">Pharmacy name</Label>
              <Input
                id="orgName"
                value={form.orgName}
                onChange={(e) => set("orgName", e.target.value)}
                placeholder="Dela Cruz Pharmacy"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ownerName">Owner name</Label>
              <Input
                id="ownerName"
                value={form.ownerName}
                onChange={(e) => set("ownerName", e.target.value)}
                placeholder="Juan dela Cruz"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="plan">Starting plan</Label>
              <select
                id="plan"
                value={form.plan}
                onChange={(e) => set("plan", e.target.value as typeof form.plan)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm capitalize"
              >
                <option value="free">Free</option>
                <option value="starter">Starter — ₱699/mo</option>
                <option value="pro">Pro — ₱1,799/mo</option>
              </select>
            </div>
            <Button type="submit" disabled={pending} className="mt-2">
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create account & generate link
            </Button>
          </form>
        </CardContent>
      </Card>

      {setupLink ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader>
            <CardTitle className="text-base text-emerald-400">Account created!</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Send this one-time setup link to the pharmacy owner. They will use it to set their
              own email and password.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={setupLink}
                className="font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button type="button" variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              </Button>
              <a
                href={setupLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium hover:bg-white/5"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              This link expires after one use. If it expires, re-create the account or use the Supabase dashboard to generate a new magic link.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
