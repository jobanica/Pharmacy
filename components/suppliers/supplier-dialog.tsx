"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  supplierSchema,
  type SupplierInput,
  type SupplierFormValues,
} from "@/lib/validation/catalog";
import { createSupplier, updateSupplier } from "@/lib/catalog/actions";

export type SupplierRow = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

export function SupplierDialog({
  supplier,
  trigger,
}: {
  supplier?: SupplierRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const isEdit = !!supplier;

  const form = useForm<SupplierFormValues, unknown, SupplierInput>({
    resolver: zodResolver(supplierSchema),
    defaultValues: defaultsFor(supplier),
  });

  React.useEffect(() => {
    if (open) form.reset(defaultsFor(supplier));
  }, [open, supplier, form]);

  function onSubmit(values: SupplierInput) {
    startTransition(async () => {
      const res = isEdit
        ? await updateSupplier(supplier!.id, values)
        : await createSupplier(values);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Supplier updated" : "Supplier added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription>Where you reorder stock from.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <Field label="Name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact person">
              <Input {...form.register("contactPerson")} />
            </Field>
            <Field label="Phone">
              <Input {...form.register("phone")} />
            </Field>
          </div>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input {...form.register("email")} placeholder="optional" />
          </Field>
          <Field label="Address">
            <Textarea rows={2} {...form.register("address")} />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} {...form.register("notes")} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {isEdit ? "Save changes" : "Add supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function defaultsFor(s?: SupplierRow): SupplierFormValues {
  return {
    name: s?.name ?? "",
    contactPerson: s?.contact_person ?? "",
    phone: s?.phone ?? "",
    email: s?.email ?? "",
    address: s?.address ?? "",
    notes: s?.notes ?? "",
  };
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
