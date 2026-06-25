"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Loader2, Trash2, CheckCircle2, ExternalLink } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { setCustomDomain, removeCustomDomain } from "@/lib/domains/actions";

/** True when the domain is an apex (e.g. mypharmacy.ph — no sub-label). */
function isApex(domain: string): boolean {
  const parts = domain.replace(/^https?:\/\//, "").split(".");
  return parts.length === 2;
}

function DnsTable({ domain }: { domain: string }) {
  const apex = isApex(domain);
  const label = domain.split(".")[0];

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Value</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {apex ? (
            <>
              <tr className="border-t border-border">
                <td className="px-3 py-2">A</td>
                <td className="px-3 py-2">@</td>
                <td className="px-3 py-2">76.76.21.21</td>
              </tr>
              <tr className="border-t border-border text-muted-foreground">
                <td className="px-3 py-2">CNAME</td>
                <td className="px-3 py-2">www</td>
                <td className="px-3 py-2">cname.vercel-dns.com</td>
              </tr>
            </>
          ) : (
            <tr className="border-t border-border">
              <td className="px-3 py-2">CNAME</td>
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2">cname.vercel-dns.com</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DomainSettings({ currentDomain }: { currentDomain: string | null }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [domain, setDomain] = React.useState(currentDomain ?? "");

  const displayDomain = currentDomain ?? domain.trim();

  function save() {
    if (!domain.trim()) {
      toast.error("Enter a domain");
      return;
    }
    start(async () => {
      const res = await setCustomDomain({ domain: domain.trim() });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Domain saved");
        router.refresh();
      }
    });
  }

  function disconnect() {
    start(async () => {
      const res = await removeCustomDomain();
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Domain disconnected");
        setDomain("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" />
            Custom domain
          </CardTitle>
          <CardDescription>
            Serve your online ordering storefront from your own domain. Customers
            see your brand — not a shared link.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {currentDomain ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                <span className="font-medium">{currentDomain}</span>
                <Badge variant="outline">Connected</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={`https://${currentDomain}`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <ExternalLink className="size-4" />
                  Visit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={disconnect}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="domain">Domain</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mypharmacy.ph or shop.mypharmacy.ph"
                className="max-w-xs"
              />
              <Button onClick={save} disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                {currentDomain ? "Update domain" : "Connect domain"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Works with apex domains (<code>mypharmacy.ph</code>) and subdomains (<code>shop.mypharmacy.ph</code>).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Point your DNS</CardTitle>
          <CardDescription>
            After saving, add these records at your domain registrar. Changes can
            take up to a few hours to take effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DnsTable domain={displayDomain || "shop.example.com"} />
          {displayDomain && isApex(displayDomain) ? (
            <p className="text-xs text-muted-foreground">
              The <strong>A</strong> record points your root domain to the server.
              The <strong>CNAME</strong> for <code>www</code> is optional but recommended
              so visitors who type <code>www.{displayDomain}</code> also reach your store.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Once the DNS record resolves, your storefront will be live on your
              domain. If the domain hasn&apos;t been added to the hosting project
              yet, ask your administrator to add it so the SSL certificate can be
              issued.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
