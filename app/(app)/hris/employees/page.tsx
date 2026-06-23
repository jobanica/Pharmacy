import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HrisNav } from "@/components/hris/hris-nav";
import { EmployeeForm } from "@/components/hris/employee-form";
import { ProUpsell } from "@/components/hris/pro-upsell";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { isProPlan } from "@/lib/billing/plans";
import { loadEmployees, PAY_TYPE_LABELS } from "@/lib/hris/hr";
import { formatCentavos } from "@/lib/money";

export default async function EmployeesPage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) notFound();
  if (!isProPlan(ctx.organization.plan)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Employees" description="Your pharmacy's staff records." />
        <HrisNav />
        <ProUpsell />
      </div>
    );
  }

  const supabase = await createClient();
  const [employees, { data: branches }, { data: memberships }] = await Promise.all([
    loadEmployees(),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("memberships").select("user_id").eq("status", "active"),
  ]);

  const userIds = (memberships ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const members = (profiles ?? []).map((p) => ({
    userId: p.id,
    name: p.full_name || "Unnamed",
  }));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Employees"
        description="Your pharmacy's staff records, pay rates and shift schedules."
      />
      <HrisNav />

      <div className="flex justify-end">
        <EmployeeForm branches={branches ?? []} members={members} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Pay</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length > 0 ? (
              employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.full_name}
                    {!e.user_id ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (no login)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{e.position ?? "—"}</TableCell>
                  <TableCell>{e.branch_id ? branchName.get(e.branch_id) ?? "—" : "—"}</TableCell>
                  <TableCell>
                    {formatCentavos(e.pay_rate_centavos)}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      / {PAY_TYPE_LABELS[e.pay_type].toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.work_start.slice(0, 5)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.is_active ? "secondary" : "outline"}>
                      {e.is_active ? "Active" : "Archived"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <EmployeeForm
                      branches={branches ?? []}
                      members={members}
                      employee={e}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No employees yet. Add your first staff member to start tracking
                  attendance and payroll.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
