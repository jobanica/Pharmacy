import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
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
import { PrintButton } from "@/components/hris/print-button";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { isProPlan } from "@/lib/billing/plans";
import { loadEmployees, buildTimesheets } from "@/lib/hris/hr";
import { formatManila } from "@/lib/date";
import { HrRangeForm, defaultRange } from "@/components/hris/range-form";

export default async function TimesheetsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) notFound();
  if (!isProPlan(ctx.organization.plan)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Timesheets" description="Hours worked per employee." />
        <HrisNav />
        <ProUpsell />
      </div>
    );
  }

  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const employees = await loadEmployees();
  const timesheets = (await buildTimesheets(employees, from, to)).filter(
    (t) => t.employee.is_active,
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Timesheets"
        description="Days present and total hours worked, computed from clock in/out."
      />
      <HrisNav />
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <HrRangeForm from={from} to={to} />
        <PrintButton label="Print timesheets" />
      </div>

      <div className="hidden print:block">
        <h2 className="text-lg font-bold">{ctx.organization.name} — Timesheets</h2>
        <p className="text-sm">
          {from} to {to}
        </p>
      </div>

      {timesheets.map((t) => (
        <div
          key={t.employee.id}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl print:border-black"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">{t.employee.full_name}</h3>
              <p className="text-xs text-muted-foreground">
                {t.employee.position ?? "Staff"}
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Days: </span>
                <span className="font-semibold">{t.daysPresent}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Hours: </span>
                <span className="font-semibold">{t.totalHours}</span>
              </span>
              <span>
                <span className="text-muted-foreground">Late: </span>
                <span className="font-semibold">{t.lateCount}</span>
              </span>
            </div>
          </div>
          {t.days.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.days.map((d) => (
                  <TableRow key={d.day}>
                    <TableCell>
                      {formatManila(`${d.day}T00:00:00+08:00`, "EEE, MMM d")}
                      {d.late ? (
                        <span className="ml-2 text-xs text-amber-300">late</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{d.clockIn ? formatManila(d.clockIn, "h:mm a") : "—"}</TableCell>
                    <TableCell>{d.clockOut ? formatManila(d.clockOut, "h:mm a") : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{d.hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.employee.user_id
                ? "No attendance in this period."
                : "Not linked to a login account — no attendance tracked."}
            </p>
          )}
        </div>
      ))}

      {timesheets.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] py-16 text-center text-sm text-muted-foreground">
          No active employees. Add staff on the Employees tab.
        </div>
      ) : null}
    </div>
  );
}
