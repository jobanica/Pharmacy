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
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS, can, type Role } from "@/lib/auth/roles";
import { RemoveMemberButton } from "@/components/settings/remove-member-button";

export default async function SettingsMembersPage() {
  const ctx = await requireAppContext();
  const canManage = can(ctx.role, "manage_members");
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role, status");

  const userIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
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
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(memberships ?? []).map((m) => {
              const isSelf = m.user_id === ctx.user.id;
              // Only an owner may remove another owner.
              const canRemove =
                canManage && !isSelf && (m.role !== "owner" || ctx.role === "owner");
              return (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium">
                    {nameById.get(m.user_id) || "—"}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{ROLE_LABELS[m.role as Role]}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === "active" ? "secondary" : "outline"}>
                      {m.status}
                    </Badge>
                  </TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {canRemove ? (
                        <RemoveMemberButton
                          userId={m.user_id}
                          name={nameById.get(m.user_id) || ""}
                        />
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
