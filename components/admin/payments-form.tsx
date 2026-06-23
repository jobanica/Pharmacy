"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Circle, Copy, Check } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { updatePlatformBilling } from "@/lib/admin/actions";

export function PaymentsForm({
  enabled,
  hasSecretKey,
  hasWebhookToken,
  webhookUrl,
}: {
  enabled: boolean;
  hasSecretKey: boolean;
  hasWebhookToken: boolean;
  webhookUrl: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [form, setForm] = React.useState({
    enabled,
    secretKey: "",
    webhookToken: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await updatePlatformBilling({
      enabled: form.enabled,
      secretKey: form.secretKey.trim() || undefined,
      webhookToken: form.webhookToken.trim() || undefined,
    });
    setPending(false);
    if ("error" in res) {
      toast.error(res.error);
    } else {
      toast.success("Payment settings saved");
      setForm((f) => ({ ...f, secretKey: "", webhookToken: "" }));
      router.refresh();
    }
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const live = enabled && hasSecretKey;

  return (
    <div className="grid max-w-2xl gap-6">
      {/* Status banner */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Payment status</CardTitle>
              <CardDescription>
                How subscribers are charged for their plans.
              </CardDescription>
            </div>
            <Badge
              className={
                live
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-400"
              }
            >
              {live ? "Live — accepting payments" : "Not collecting payments"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          <StatusRow done={hasSecretKey} label="Xendit secret key configured" />
          <StatusRow done={hasWebhookToken} label="Webhook verification token configured" />
          <StatusRow done={enabled} label="Live payments enabled" />
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle>Xendit credentials</CardTitle>
          <CardDescription>
            Paste your keys from the{" "}
            <a
              href="https://dashboard.xendit.co/settings/developers#api-keys"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Xendit dashboard
            </a>
            . Keys are stored securely and never shown again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="secretKey">
                Secret API key
                {hasSecretKey ? (
                  <span className="ml-2 text-xs text-emerald-400">• already set</span>
                ) : null}
              </Label>
              <Input
                id="secretKey"
                type="password"
                autoComplete="off"
                value={form.secretKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, secretKey: e.target.value }))
                }
                placeholder={
                  hasSecretKey ? "•••••••• (leave blank to keep)" : "xnd_production_..."
                }
              />
              <p className="text-xs text-muted-foreground">
                Use a live key (<code>xnd_production_…</code>) to charge real money,
                or a test key (<code>xnd_development_…</code>) to try the flow.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="webhookToken">
                Webhook verification token
                {hasWebhookToken ? (
                  <span className="ml-2 text-xs text-emerald-400">• already set</span>
                ) : null}
              </Label>
              <Input
                id="webhookToken"
                type="password"
                autoComplete="off"
                value={form.webhookToken}
                onChange={(e) =>
                  setForm((f) => ({ ...f, webhookToken: e.target.value }))
                }
                placeholder={
                  hasWebhookToken ? "•••••••• (leave blank to keep)" : "Webhook token"
                }
              />
            </div>

            <label className="flex items-center justify-between gap-4 rounded-lg border border-white/10 p-3">
              <span className="text-sm">
                <span className="font-medium">Enable live payments</span>
                <span className="block text-xs text-muted-foreground">
                  When on, subscribers are sent to Xendit checkout to pay for their plan.
                </span>
              </span>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </label>

            <Button type="submit" disabled={pending} className="mt-1 justify-self-start">
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Save payment settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Webhook setup */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>
            In Xendit → Settings → Webhooks, set the <strong>Invoices paid</strong>{" "}
            callback URL to the address below, then paste its verification token above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
              {webhookUrl}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copyWebhook}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="size-4 text-emerald-400" />
      ) : (
        <Circle className="size-4 text-muted-foreground" />
      )}
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
