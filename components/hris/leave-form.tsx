"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createLeave, type LeaveInput } from "@/lib/hris/employee-actions";

type EmployeeOption = { id: string; name: string };

const LEAVE_TYPES = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "emergency", label: "Emergency" },
  { value: "unpaid", label: "Unpaid" },
  { value: "maternity", label: "Maternity" },
  { value: "paternity", label: "Paternity" },
] as const;

export function LeaveForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState<LeaveInput>({
    employeeId: employees[0]?.id ?? "",
    leaveType: "vacation",
    startDate: "",
    endDate: "",
    reason: "",
  });

  function set<K extends keyof LeaveInput>(key: K, value: LeaveInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function save() {
    start(async () => {
      const res = await createLeave(form);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Leave request filed");
      setOpen(false);
      setForm((f) => ({ ...f, startDate: "", endDate: "", reason: "" }));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={employees.length === 0}>
            <Plus className="size-4" />
            File leave
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File a leave request</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Employee</Label>
            <select
              value={form.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <select
              value={form.leaveType}
              onChange={(e) =>
                set("leaveType", e.target.value as LeaveInput["leaveType"])
              }
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Reason</Label>
            <Textarea
              rows={2}
              value={form.reason ?? ""}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            File request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
