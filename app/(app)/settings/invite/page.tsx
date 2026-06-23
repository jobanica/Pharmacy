import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteForm } from "@/components/settings/invite-form";
import { CopyInviteLink } from "@/components/settings/copy-invite-link";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can, ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { revokeInviteAction } from "@/lib/settings/actions";
import { formatManila } from "@/lib/date";

export default async function SettingsInvitePage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) redirect("/settings");

  const supabase = await createClient();
  const [{ data: invites }, { data: branches }] = await Promise.all([
    supabase
      .from("invitations")
      .select("id, email, role, token, expires_at, branch_id")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("branches")
      .select("id, name")
      .order("name", { ascending: true }),
  ]);

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a teammate</CardTitle>
        <CardDescription>
          They&apos;ll get a link to set up their account and join your pharmacy.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <InviteForm branches={branches ?? []} />

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
                    {ROLE_LABELS[inv.role as Role]}
                    {inv.branch_id
                      ? ` · ${(branches ?? []).find((b) => b.id === inv.branch_id)?.name ?? "Branch"}`
                      : ""}
                    {" · expires "}
                    {formatManila(inv.expires_at, "MMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {origin ? (
                    <CopyInviteLink url={`${origin}/accept-invite?token=${inv.token}`} />
                  ) : null}
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="id" value={inv.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
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
  );
}
