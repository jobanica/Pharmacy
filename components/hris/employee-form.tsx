"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEmployee,
  updateEmployee,
  type EmployeeInput,
} from "@/lib/hris/employee-actions";
import { centavosToPesos } from "@/lib/money";
import type { Employee } from "@/lib/supabase/types";

type Branch = { id: string; name: string };
type Member = { userId: string; name: string };

const PAY_TYPES = [
  { value: "monthly", label: "Monthly salary" },
  { value: "daily", label: "Daily rate" },
  { value: "hourly", label: "Hourly rate" },
] as const;

export function EmployeeForm({
  branches,
  members,
  employee,
}: {
  branches: Branch[];
  members: Member[];
  employee?: Employee;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const editing = Boolean(employee);

  const [form, setForm] = React.useState<EmployeeInput>({
    fullName: employee?.full_name ?? "",
    position: employee?.position ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    branchId: employee?.branch_id ?? "",
    userId: employee?.user_id ?? "",
    payType: employee?.pay_type ?? "monthly",
    payRate: employee ? String(centavosToPesos(employee.pay_rate_centavos)) : "",
    workStart: employee?.work_start?.slice(0, 5) ?? "09:00",
    workHoursPerDay: employee?.work_hours_per_day ?? 8,
    graceMinutes: employee?.grace_minutes ?? 0,
    hireDate: employee?.hire_date ?? "",
  });

  function set<K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    start(async () => {
      const res = employee
        ? await updateEmployee(employee.id, form)
        : await createEmployee(form);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Employee updated" : "Employee added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          editing ? (
            <Button variant="ghost" size="sm">
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" />
              Add employee
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            Link to a login account to track attendance, late and payroll hours
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Juan dela Cruz"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Position</Label>
              <Input
                value={form.position ?? ""}
                onChange={(e) => set("position", e.target.value)}
                placeholder="Pharmacist"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Branch</Label>
              <select
                value={form.branchId ?? ""}
                onChange={(e) => set("branchId", e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">— None —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>Login account</Label>
              <select
                value={form.userId ?? ""}
                onChange={(e) => set("userId", e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">— Not linked —</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Pay type</Label>
              <select
                value={form.payType}
                onChange={(e) =>
                  set("payType", e.target.value as EmployeeInput["payType"])
                }
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                {PAY_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>
                Rate (₱
                {form.payType === "hourly"
                  ? " / hour"
                  : form.payType === "daily"
                    ? " / day"
                    : " / month"}
                )
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                value={form.payRate ?? ""}
                onChange={(e) => set("payRate", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Shift start</Label>
              <Input
                type="time"
                value={form.workStart ?? "09:00"}
                onChange={(e) => set("workStart", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Grace (min)</Label>
              <Input
                type="number"
                value={String(form.graceMinutes ?? 0)}
                onChange={(e) => set("graceMinutes", Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Hours / day</Label>
              <Input
                type="number"
                value={String(form.workHoursPerDay ?? 8)}
                onChange={(e) => set("workHoursPerDay", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Hire date</Label>
            <Input
              type="date"
              value={form.hireDate ?? ""}
              onChange={(e) => set("hireDate", e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {editing ? "Save changes" : "Add employee"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
