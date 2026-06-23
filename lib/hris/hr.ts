import "server-only";

/**
 * HR computation helpers. Timesheets, late reports and payroll are all derived
 * from the append-only `attendance` log joined to `employees` (via user_id) —
 * there is no separate hours table. Everything here is reckoned in Asia/Manila.
 */
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date";
import type {
  Employee,
  EmployeePayType,
  LeaveKind,
} from "@/lib/supabase/types";

export const PAY_TYPE_LABELS: Record<EmployeePayType, string> = {
  hourly: "Hourly",
  daily: "Daily",
  monthly: "Monthly",
};

export const LEAVE_LABELS: Record<LeaveKind, string> = {
  vacation: "Vacation",
  sick: "Sick",
  emergency: "Emergency",
  unpaid: "Unpaid",
  maternity: "Maternity",
  paternity: "Paternity",
};

/** "09:00:00" or "09:00" → minutes past midnight. */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

export type DayEntry = {
  day: string; // yyyy-MM-dd (Manila)
  clockIn: string | null; // ISO
  clockOut: string | null; // ISO
  hours: number; // worked hours (0 if no pair)
  late: boolean;
  lateBy: number; // minutes past the grace-adjusted start
};

export type Timesheet = {
  employee: Employee;
  days: DayEntry[];
  daysPresent: number;
  totalHours: number;
  lateCount: number;
};

/** Fetch active employees for the caller's org (RLS-scoped). */
export async function loadEmployees(): Promise<Employee[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("*")
    .order("is_active", { ascending: false })
    .order("full_name");
  return (data ?? []) as Employee[];
}

/**
 * Build per-employee timesheets for the inclusive Manila date range
 * [from, to]. Only employees linked to an auth user (user_id) accrue hours,
 * since attendance is keyed by user_id.
 */
export async function buildTimesheets(
  employees: Employee[],
  from: string,
  to: string,
): Promise<Timesheet[]> {
  const supabase = await createClient();

  // Range in UTC: start of `from` .. end of `to` (Manila), padded a day each
  // side so boundary clock-outs are captured, then filtered by Manila day.
  const startUtc = new Date(`${from}T00:00:00+08:00`);
  const endUtc = new Date(`${to}T00:00:00+08:00`);
  endUtc.setUTCDate(endUtc.getUTCDate() + 1);

  const { data: records } = await supabase
    .from("attendance")
    .select("user_id, kind, created_at")
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", endUtc.toISOString())
    .order("created_at", { ascending: true });

  // Group attendance by user → Manila day → { firstIn, lastOut }.
  type Slot = { firstIn: string | null; lastOut: string | null };
  const byUser = new Map<string, Map<string, Slot>>();
  for (const r of records ?? []) {
    if (!r.user_id) continue;
    const day = formatManila(r.created_at, "yyyy-MM-dd");
    let days = byUser.get(r.user_id);
    if (!days) byUser.set(r.user_id, (days = new Map()));
    const slot = days.get(day) ?? { firstIn: null, lastOut: null };
    if (r.kind === "clock_in") {
      if (!slot.firstIn) slot.firstIn = r.created_at;
    } else {
      slot.lastOut = r.created_at;
    }
    days.set(day, slot);
  }

  return employees.map((employee) => {
    const slots = employee.user_id ? byUser.get(employee.user_id) : undefined;
    const startMin = timeToMinutes(employee.work_start) + employee.grace_minutes;

    const days: DayEntry[] = [];
    if (slots) {
      for (const [day, slot] of [...slots.entries()].sort()) {
        let hours = 0;
        if (slot.firstIn && slot.lastOut) {
          hours = Math.max(
            0,
            (new Date(slot.lastOut).getTime() - new Date(slot.firstIn).getTime()) /
              3_600_000,
          );
        }
        let late = false;
        let lateBy = 0;
        if (slot.firstIn) {
          const inMin = timeToMinutes(formatManila(slot.firstIn, "HH:mm"));
          if (inMin > startMin) {
            late = true;
            lateBy = inMin - startMin;
          }
        }
        days.push({
          day,
          clockIn: slot.firstIn,
          clockOut: slot.lastOut,
          hours: Math.round(hours * 100) / 100,
          late,
          lateBy,
        });
      }
    }

    const daysPresent = days.filter((d) => d.clockIn).length;
    const totalHours = Math.round(days.reduce((s, d) => s + d.hours, 0) * 100) / 100;
    const lateCount = days.filter((d) => d.late).length;
    return { employee, days, daysPresent, totalHours, lateCount };
  });
}

export type PayslipRow = {
  employee: Employee;
  daysPresent: number;
  totalHours: number;
  grossCentavos: number;
  deductionsCentavos: number;
  netCentavos: number;
};

/** Compute gross pay for one employee from their timesheet totals. */
function grossFor(
  payType: EmployeePayType,
  rateCentavos: number,
  daysPresent: number,
  totalHours: number,
): number {
  switch (payType) {
    case "hourly":
      return Math.round(rateCentavos * totalHours);
    case "daily":
      return rateCentavos * daysPresent;
    case "monthly":
      return rateCentavos;
  }
}

/** Build a payroll register for the period from the timesheets. */
export function buildPayroll(timesheets: Timesheet[]): PayslipRow[] {
  return timesheets
    .filter((t) => t.employee.is_active)
    .map((t) => {
      const gross = grossFor(
        t.employee.pay_type,
        t.employee.pay_rate_centavos,
        t.daysPresent,
        t.totalHours,
      );
      return {
        employee: t.employee,
        daysPresent: t.daysPresent,
        totalHours: t.totalHours,
        grossCentavos: gross,
        deductionsCentavos: 0,
        netCentavos: gross,
      };
    });
}
