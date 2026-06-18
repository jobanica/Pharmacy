"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  productSchema,
  type ProductInput,
  type ProductFormValues,
} from "@/lib/validation/catalog";
import { createProduct, updateProduct } from "@/lib/catalog/actions";
import { centavosToPesos } from "@/lib/money";

export type ProductRow = {
  id: string;
  name: string;
  generic_name: string | null;
  category_id: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  requires_prescription: boolean;
  reorder_point: number;
  default_price_centavos: number;
  is_active: boolean;
};

type CategoryOption = { id: string; name: string };

const UNITS = ["piece", "tablet", "capsule", "bottle", "box", "sachet", "tube", "vial", "ml"];

export function ProductDialog({
  categories,
  product,
  trigger,
}: {
  categories: CategoryOption[];
  product?: ProductRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const isEdit = !!product;

  const form = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultsFor(product),
  });

  React.useEffect(() => {
    if (open) form.reset(defaultsFor(product));
  }, [open, product, form]);

  function onSubmit(values: ProductInput) {
    startTransition(async () => {
      const res = isEdit
        ? await updateProduct(product!.id, values)
        : await createProduct(values);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Product updated" : "Product added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Selling price is per unit; cost is captured when you receive stock.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <Field label="Brand name" error={form.formState.errors.name?.message}>
            <Input {...form.register("name")} autoFocus />
          </Field>

          <Field label="Generic name">
            <Input {...form.register("genericName")} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select
                {...form.register("categoryId")}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
                defaultValue={product?.category_id ?? ""}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <select
                {...form.register("unit")}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU" error={form.formState.errors.sku?.message}>
              <Input {...form.register("sku")} placeholder="optional" />
            </Field>
            <Field label="Barcode" error={form.formState.errors.barcode?.message}>
              <Input {...form.register("barcode")} placeholder="optional" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Selling price (₱)" error={form.formState.errors.price?.message}>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...form.register("price")}
              />
            </Field>
            <Field
              label="Reorder point"
              error={form.formState.errors.reorderPoint?.message}
            >
              <Input type="number" min="0" {...form.register("reorderPoint")} />
            </Field>
          </div>

          <Controller
            control={form.control}
            name="requiresPrescription"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
                Requires prescription
              </label>
            )}
          />

          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center justify-between text-sm">
                <span>Active (sellable)</span>
                <Switch
                  checked={!!field.value}
                  onCheckedChange={(v) => field.onChange(v)}
                />
              </label>
            )}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {isEdit ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function defaultsFor(product?: ProductRow): ProductFormValues {
  return {
    name: product?.name ?? "",
    genericName: product?.generic_name ?? "",
    categoryId: product?.category_id ?? undefined,
    sku: product?.sku ?? "",
    barcode: product?.barcode ?? "",
    unit: product?.unit ?? "piece",
    requiresPrescription: product?.requires_prescription ?? false,
    reorderPoint: product?.reorder_point ?? 0,
    price: product ? centavosToPesos(product.default_price_centavos) : 0,
    isActive: product?.is_active ?? true,
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
