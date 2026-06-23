import { notFound } from "next/navigation";
import { AlarmClock } from "lucide-react";

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
import { ProUpsell } from "@/components/hris/pro-upsell";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { isProPlan } from "@/lib/billing/plans";
import { loadEmployees, buildTimesheets } from "@/lib/hris/hr";
import { manilaBusinessDay, formatManila } from "@/lib/date";
import { HrRangeForm, defaultRange } from "@/components/hris/range-form";

export default async function LateReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) notFound();
  if (!isProPlan(ctx.organization.plan)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Late report" description="Tardiness by employee." />
        <HrisNav />
        <ProUpsell />
      </div>
    );
  }

  const sp = await searchParams;
  const { from, to } = defaultRange(sp);

  const employees = await loadEmployees();
  const timesheets = await buildTimesheets(employees, from, to);

  // Flatten to one row per late day.
  const lateRows = timesheets
    .flatMap((t) =>
      t.days
        .filter((d) => d.late)
        .map((d) => ({ name: t.employee.full_name, ...d, start: t.employee.work_start.slice(0, 5) })),
    )
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Late report"
        description="Days an employee's first clock-in fell after their shift start (plus grace)."
      />
      <HrisNav />
      <HrRangeForm from={from} to={to} />

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Shift start</TableHead>
              <TableHead>Clock in</TableHead>
              <TableHead className="text-right">Late by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lateRows.length > 0 ? (
              lateRows.map((r, i) => (
                <TableRow key={`${r.name}-${r.day}-${i}`}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{formatManila(`${r.day}T00:00:00+08:00`, "EEE, MMM d")}</TableCell>
                  <TableCell className="text-muted-foreground">{r.start}</TableCell>
                  <TableCell>{r.clockIn ? formatManila(r.clockIn, "h:mm a") : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="text-amber-300">
                      <AlarmClock className="mr-1 size-3" />
                      {r.lateBy} min
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No late clock-ins between {from} and {to}. 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        As of {manilaBusinessDay()}. Late is computed from each employee&apos;s
        shift start and grace minutes (set on their profile).
      </p>
    </div>
  );
}
