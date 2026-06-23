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
import {
  loadEmployees,
  buildTimesheets,
  buildPayroll,
  PAY_TYPE_LABELS,
} from "@/lib/hris/hr";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import { HrRangeForm, defaultRange } from "@/components/hris/range-form";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) notFound();
  if (!isProPlan(ctx.organization.plan)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Payroll" description="Printable payroll register." />
        <HrisNav />
        <ProUpsell />
      </div>
    );
  }

  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const employees = await loadEmployees();
  const timesheets = await buildTimesheets(employees, from, to);
  const rows = buildPayroll(timesheets);

  const totalGross = rows.reduce((s, r) => s + r.grossCentavos, 0);
  const totalNet = rows.reduce((s, r) => s + r.netCentavos, 0);

  return (
    <div className="grid gap-6">
      <div className="print:hidden">
        <PageHeader
          title="Payroll"
          description="A printable pay register for the period — hours and rates become pay."
        />
      </div>
      <div className="print:hidden">
        <HrisNav />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <HrRangeForm from={from} to={to} />
        <PrintButton label="Print payroll" />
      </div>

      {/* Printable register */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl print:border-0 print:bg-white print:p-0 print:text-black">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">{ctx.organization.name}</h2>
          <p className="text-sm text-muted-foreground print:text-black">
            Payroll register · {formatManila(`${from}T00:00:00+08:00`, "MMM d, yyyy")} –{" "}
            {formatManila(`${to}T00:00:00+08:00`, "MMM d, yyyy")}
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Basis</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right">Net pay</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <TableRow key={r.employee.id}>
                  <TableCell className="font-medium">
                    {r.employee.full_name}
                    <div className="text-xs text-muted-foreground print:text-black">
                      {r.employee.position ?? "Staff"}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {PAY_TYPE_LABELS[r.employee.pay_type]} ·{" "}
                    {formatCentavos(r.employee.pay_rate_centavos)}
                  </TableCell>
                  <TableCell className="text-right">{r.daysPresent}</TableCell>
                  <TableCell className="text-right">{r.totalHours}</TableCell>
                  <TableCell className="text-right">{formatCentavos(r.grossCentavos)}</TableCell>
                  <TableCell className="text-right">{formatCentavos(r.deductionsCentavos)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCentavos(r.netCentavos)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No active employees to run payroll for.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {rows.length > 0 ? (
          <div className="mt-4 flex justify-end gap-8 border-t border-white/10 pt-3 text-sm print:border-black">
            <span>
              <span className="text-muted-foreground print:text-black">Total gross: </span>
              <span className="font-semibold">{formatCentavos(totalGross)}</span>
            </span>
            <span>
              <span className="text-muted-foreground print:text-black">Total net: </span>
              <span className="font-bold">{formatCentavos(totalNet)}</span>
            </span>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground print:hidden">
        Hourly pay uses total hours; daily pay uses days present; monthly pay is
        the fixed rate for the period. Employees linked to a login account accrue
        hours automatically from attendance.
      </p>
    </div>
  );
}
