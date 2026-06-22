import { headers } from "next/headers";
import { Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteForm } from "@/components/settings/invite-form";
import { CopyInviteLink } from "@/components/settings/copy-invite-link";
import { BillingSection } from "@/components/settings/billing-section";
import { BrandingSettings } from "@/components/settings/branding-settings";
import { LoyaltySettings } from "@/components/settings/loyalty-settings";
import { readBrand } from "@/lib/branding";
import { readLoyalty } from "@/lib/loyalty/settings";
import { publicEnv } from "@/lib/env";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { revokeInviteAction } from "@/lib/settings/actions";
import { getSubscription, isBillingEnabled } from "@/lib/billing/service";
import { formatManila } from "@/lib/date";

export default async function SettingsPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const [{ data: memberships }, { data: invites }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, status"),
    supabase
      .from("invitations")
      .select("id, email, role, token, expires_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const userIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const canManageMembers = can(ctx.role, "manage_members");
  const isOwner = ctx.role === "owner";
  const subscription = isOwner ? await getSubscription() : null;
  const brand = readBrand(ctx.organization.settings);
  const loyalty = readLoyalty(ctx.organization.settings);
  const canManageLoyalty = ctx.role === "owner" || ctx.role === "manager";

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description="Organization, team members, and billing."
      />

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Your pharmacy business account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{ctx.organization.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Your role</span>
            <span className="font-medium">{ROLE_LABELS[ctx.role]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Branches</span>
            <span className="font-medium">{ctx.branches.length}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People with access to this pharmacy.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(memberships ?? []).map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">
                    {nameById.get(m.user_id) || "—"}
                    {m.user_id === ctx.user.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (you)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{ROLE_LABELS[m.role as Role]}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === "active" ? "secondary" : "outline"}>
                      {m.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManageMembers ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <CardDescription>
              They&apos;ll get a link to set up their account and join your
              pharmacy.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <InviteForm />

            {invites && invites.length > 0 ? (
              <div className="grid gap-3">
                <p className="text-sm font-medium">Pending invitations</p>
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{inv.email}</span>
                      <span className="ml-2 text-muted-foreground">
                        {ROLE_LABELS[inv.role as Role]} · expires{" "}
                        {formatManila(inv.expires_at, "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {origin ? (
                        <CopyInviteLink
                          url={`${origin}/accept-invite?token=${inv.token}`}
                        />
                      ) : null}
                      <form action={revokeInviteAction}>
                        <input type="hidden" name="id" value={inv.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Revoke
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? (
        <BrandingSettings
          appName={publicEnv.NEXT_PUBLIC_APP_NAME}
          brandName={brand.name}
          logoUrl={brand.logoUrl}
          header={brand.receipt.header ?? ""}
          footer={brand.receipt.footer ?? ""}
          paper={brand.receipt.paper}
          autoPrint={brand.receipt.autoPrint}
        />
      ) : null}

      {canManageLoyalty ? (
        <LoyaltySettings pesoPerPoint={loyalty.pesoPerPoint} />
      ) : null}

      {isOwner ? (
        <BillingSection
          currentPlan={subscription?.plan ?? "free"}
          status={subscription?.status ?? "active"}
          enabled={isBillingEnabled()}
        />
      ) : null}
    </div>
  );
}
