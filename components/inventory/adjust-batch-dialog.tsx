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
  adjustBatchSchema,
  type AdjustBatchInput,
  type AdjustBatchFormValues,
} from "@/lib/validation/inventory";
import { adjustBatch } from "@/lib/inventory/actions";

export function AdjustBatchDialog({
  batchId,
  productId,
  currentQuantity,
  trigger,
}: {
  batchId: string;
  productId: string;
  currentQuantity: number;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const form = useForm<AdjustBatchFormValues, unknown, AdjustBatchInput>({
    resolver: zodResolver(adjustBatchSchema),
    defaultValues: { batchId, newQuantity: currentQuantity, reason: "" },
  });

  React.useEffect(() => {
    if (open) form.reset({ batchId, newQuantity: currentQuantity, reason: "" });
  }, [open, batchId, currentQuantity, form]);

  function onSubmit(values: AdjustBatchInput) {
    startTransition(async () => {
      const res = await adjustBatch(values, productId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Stock adjusted");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust batch quantity</DialogTitle>
          <DialogDescription>
            Current: {currentQuantity}. Enter the corrected on-hand count; the
            difference is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <input type="hidden" {...form.register("batchId")} />
          <div className="grid gap-2">
            <Label>New quantity</Label>
            <Input type="number" min="0" {...form.register("newQuantity")} autoFocus />
            {form.formState.errors.newQuantity ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.newQuantity.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label>Reason</Label>
            <Textarea
              rows={2}
              placeholder="e.g. stock count correction, damage"
              {...form.register("reason")}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
