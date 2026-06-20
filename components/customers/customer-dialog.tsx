"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCustomer, updateCustomer } from "@/lib/loyalty/actions";

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  birthdate: string | null;
  notes: string | null;
};

export function CustomerDialog({
  customer,
  trigger,
}: {
  customer?: CustomerRecord;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!customer;
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const defaults = React.useCallback(
    () => ({
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      address: customer?.address ?? "",
      birthdate: customer?.birthdate ?? "",
      notes: customer?.notes ?? "",
    }),
    [customer],
  );
  const [form, setForm] = React.useState(defaults);

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) setForm(defaults());
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    start(async () => {
      const res = isEdit ? await updateCustomer(customer!.id, form) : await createCustomer(form);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Customer updated" : "Customer saved");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit customer" : "New customer"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Full name">
            <Input value={form.name} onChange={set("name")} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={form.phone} onChange={set("phone")} placeholder="09xx xxx xxxx" />
            </Field>
            <Field label="Birthdate">
              <Input type="date" value={form.birthdate} onChange={set("birthdate")} />
            </Field>
          </div>
          <Field label="Email">
            <Input value={form.email} onChange={set("email")} placeholder="optional" />
          </Field>
          <Field label="Address">
            <Textarea rows={2} value={form.address} onChange={set("address")} />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={set("notes")} placeholder="allergies, preferences…" />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {isEdit ? "Save changes" : "Save customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
