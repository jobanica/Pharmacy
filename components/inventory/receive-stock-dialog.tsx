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
import {
  receiveStockSchema,
  type ReceiveStockInput,
  type ReceiveStockFormValues,
} from "@/lib/validation/inventory";
import { receiveStock } from "@/lib/inventory/actions";

type SupplierOption = { id: string; name: string };

export function ReceiveStockDialog({
  productId,
  productName,
  branchName,
  suppliers,
  trigger,
}: {
  productId: string;
  productName: string;
  branchName: string;
  suppliers: SupplierOption[];
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<ReceiveStockFormValues, unknown, ReceiveStockInput>({
    resolver: zodResolver(receiveStockSchema),
    defaultValues: {
      productId,
      supplierId: "",
      batchNumber: "",
      expiryDate: "",
      quantity: 1,
      cost: 0,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        productId,
        supplierId: "",
        batchNumber: "",
        expiryDate: "",
        quantity: 1,
        cost: 0,
      });
    }
  }, [open, productId, form]);

  function onSubmit(values: ReceiveStockInput) {
    startTransition(async () => {
      const res = await receiveStock(values);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Stock received");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive stock</DialogTitle>
          <DialogDescription>
            {productName} → {branchName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <input type="hidden" {...form.register("productId")} />

          <div className="grid gap-2">
            <Label>Supplier</Label>
            <select
              {...form.register("supplierId")}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="">— none —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Batch number</Label>
              <Input {...form.register("batchNumber")} placeholder="optional" />
            </div>
            <div className="grid gap-2">
              <Label>Expiry date</Label>
              <Input type="date" {...form.register("expiryDate")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Quantity</Label>
              <Input type="number" min="1" {...form.register("quantity")} />
              {form.formState.errors.quantity ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.quantity.message}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Unit cost (₱)</Label>
              <Input type="number" step="0.01" min="0" {...form.register("cost")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Receive
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
