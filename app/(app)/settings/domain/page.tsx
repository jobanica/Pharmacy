import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canUseCustomDomain } from "@/lib/billing/plans";
import { DomainSettings } from "@/components/settings/domain-settings";

export const dynamic = "force-dynamic";

export default async function SettingsDomainPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") redirect("/settings");

  if (!canUseCustomDomain(ctx.organization.plan)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Custom domains are a Pro feature
          </CardTitle>
          <CardDescription>
            Upgrade to Pro to put your online ordering storefront on your own
            domain (e.g. shop.mypharmacy.ph) instead of a shared link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/settings/billing" />}>Upgrade to Pro</Button>
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("custom_domain")
    .eq("id", ctx.organization.id)
    .maybeSingle();

  return <DomainSettings currentDomain={org?.custom_domain ?? null} />;
}
