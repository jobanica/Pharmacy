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
import { LeaveForm } from "@/components/hris/leave-form";
import { LeaveReviewButtons } from "@/components/hris/leave-actions";
import { ProUpsell } from "@/components/hris/pro-upsell";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { isProPlan } from "@/lib/billing/plans";
import { loadEmployees, LEAVE_LABELS } from "@/lib/hris/hr";
import { formatManila } from "@/lib/date";
import type { LeaveStatus } from "@/lib/supabase/types";

const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: "text-amber-300",
  approved: "text-emerald-300",
  rejected: "text-destructive",
};

export default async function LeavePage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) notFound();
  if (!isProPlan(ctx.organization.plan)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Leave" description="Leave requests and approvals." />
        <HrisNav />
        <ProUpsell />
      </div>
    );
  }

  const supabase = await createClient();
  const [employees, { data: requests }] = await Promise.all([
    loadEmployees(),
    supabase
      .from("leave_requests")
      .select("*, employees(full_name)")
      .order("created_at", { ascending: false }),
  ]);

  const activeEmployees = employees
    .filter((e) => e.is_active)
    .map((e) => ({ id: e.id, name: e.full_name }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Leave"
        description="File leave on behalf of staff and approve pending requests."
      />
      <HrisNav />

      <div className="flex justify-end">
        <LeaveForm employees={activeEmployees} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests && requests.length > 0 ? (
              requests.map((r) => {
                const status = r.status as LeaveStatus;
                const name =
                  (r as { employees: { full_name: string } | null }).employees
                    ?.full_name ?? "—";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell>{LEAVE_LABELS[r.leave_type]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatManila(`${r.start_date}T00:00:00+08:00`, "MMM d")} –{" "}
                      {formatManila(`${r.end_date}T00:00:00+08:00`, "MMM d")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {r.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[status]}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {status === "pending" ? (
                        <LeaveReviewButtons id={r.id} />
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.reviewed_at
                            ? formatManila(r.reviewed_at, "MMM d, h:mm a")
                            : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No leave requests yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
