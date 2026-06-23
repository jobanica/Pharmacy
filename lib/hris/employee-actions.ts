"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { isProPlan } from "@/lib/billing/plans";
import { pesosToCentavos } from "@/lib/money";

export type Result = { ok: true } | { error: string };

/** Owner/manager + Pro gate shared by every HR mutation. */
async function guard() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) {
    return { ok: false as const, error: "You do not have access to HR" };
  }
  if (!isProPlan(ctx.organization.plan)) {
    return { ok: false as const, error: "HR is a Pro feature" };
  }
  return { ok: true as const, ctx };
}

const employeeSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(120),
  position: z.string().max(80).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  branchId: z.string().uuid().optional().or(z.literal("")),
  userId: z.string().uuid().optional().or(z.literal("")),
  payType: z.enum(["hourly", "daily", "monthly"]),
  payRate: z.string().optional(),
  workStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workHoursPerDay: z.coerce.number().min(0).max(24).optional(),
  graceMinutes: z.coerce.number().int().min(0).max(240).optional(),
  hireDate: z.string().optional().or(z.literal("")),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

function toRow(data: EmployeeInput) {
  return {
    full_name: data.fullName.trim(),
    position: data.position?.trim() || null,
    email: data.email?.trim() || null,
    phone: data.phone?.trim() || null,
    branch_id: data.branchId || null,
    user_id: data.userId || null,
    pay_type: data.payType,
    pay_rate_centavos: data.payRate ? pesosToCentavos(data.payRate) : 0,
    work_start: data.workStart || "09:00",
    work_hours_per_day: data.workHoursPerDay ?? 8,
    grace_minutes: data.graceMinutes ?? 0,
    hire_date: data.hireDate || null,
  };
}

export async function createEmployee(input: EmployeeInput): Promise<Result> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("employees").insert({
    organization_id: g.ctx.organization.id,
    ...toRow(parsed.data),
  });
  if (error) return { error: error.message };
  revalidatePath("/hris/employees");
  return { ok: true };
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput,
): Promise<Result> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const parsed = employeeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update(toRow(parsed.data))
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hris/employees");
  return { ok: true };
}

export async function setEmployeeActive(
  id: string,
  isActive: boolean,
): Promise<Result> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hris/employees");
  return { ok: true };
}

const leaveSchema = z.object({
  employeeId: z.string().uuid(),
  leaveType: z.enum([
    "vacation",
    "sick",
    "emergency",
    "unpaid",
    "maternity",
    "paternity",
  ]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().max(400).optional(),
});
export type LeaveInput = z.infer<typeof leaveSchema>;

export async function createLeave(input: LeaveInput): Promise<Result> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const parsed = leaveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data.endDate < parsed.data.startDate) {
    return { error: "End date can't be before the start date" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leave_requests").insert({
    organization_id: g.ctx.organization.id,
    employee_id: parsed.data.employeeId,
    leave_type: parsed.data.leaveType,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
    reason: parsed.data.reason?.trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/hris/leave");
  return { ok: true };
}

export async function reviewLeave(
  id: string,
  status: "approved" | "rejected",
): Promise<Result> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("leave_requests")
    .update({
      status,
      reviewed_by: g.ctx.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hris/leave");
  return { ok: true };
}
