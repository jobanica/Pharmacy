"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { createProduct, updateProduct, createCategory } from "@/lib/catalog/actions";
import { receiveStock } from "@/lib/inventory/actions";
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
type SupplierOption = { id: string; name: string };

const UNITS = ["piece", "tablet", "capsule", "bottle", "box", "sachet", "tube", "vial", "ml"];
const EMPTY_STOCK = { qty: "", batch: "", expiry: "", cost: "", supplier: "" };

export function ProductDialog({
  categories,
  suppliers = [],
  product,
  trigger,
}: {
  categories: CategoryOption[];
  suppliers?: SupplierOption[];
  product?: ProductRow;
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const isEdit = !!product;

  const [cats, setCats] = React.useState(categories);
  const [newCat, setNewCat] = React.useState("");
  const [addingCat, setAddingCat] = React.useState(false);
  const [stock, setStock] = React.useState(EMPTY_STOCK);

  const form = useForm<ProductFormValues, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: defaultsFor(product),
  });

  function onOpenChange(v: boolean) {
    setOpen(v);
    if (v) {
      form.reset(defaultsFor(product));
      setCats(categories);
      setStock(EMPTY_STOCK);
      setNewCat("");
      setAddingCat(false);
    }
  }

  function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createCategory({ name });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const id = res.id!;
      setCats((c) => [...c, { id, name }].sort((a, b) => a.name.localeCompare(b.name)));
      form.setValue("categoryId", id);
      setNewCat("");
      setAddingCat(false);
      toast.success("Category added");
    });
  }

  function onSubmit(values: ProductInput) {
    startTransition(async () => {
      const res = isEdit
        ? await updateProduct(product!.id, values)
        : await createProduct(values);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }

      // On create, optionally receive opening stock for the new product.
      const qty = Number(stock.qty);
      if (!isEdit && "id" in res && res.id && qty > 0) {
        const stockRes = await receiveStock({
          productId: res.id,
          quantity: qty,
          cost: Number(stock.cost) || 0,
          batchNumber: stock.batch || undefined,
          expiryDate: stock.expiry || undefined,
          supplierId: stock.supplier || "",
        });
        if ("error" in stockRes) {
          toast.error(`Product saved, but stock failed: ${stockRes.error}`);
          setOpen(false);
          router.refresh();
          return;
        }
      }

      toast.success(isEdit ? "Product updated" : "Product added");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Selling price is per unit. Add opening stock with its batch, expiry,
            and cost below.
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
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <select
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    className="h-9 rounded-md border bg-transparent px-3 text-sm"
                  >
                    <option value="">Uncategorized</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {addingCat ? (
                <div className="mt-1 flex gap-1">
                  <Input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="New category"
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCategory();
                      }
                    }}
                  />
                  <Button type="button" size="sm" onClick={addCategory} disabled={pending}>
                    Add
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCat(true)}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-fuchsia-300 hover:underline"
                >
                  <Plus className="size-3" /> New category
                </button>
              )}
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
              <Input type="number" step="0.01" min="0" {...form.register("price")} />
            </Field>
            <Field label="Reorder point" error={form.formState.errors.reorderPoint?.message}>
              <Input type="number" min="0" {...form.register("reorderPoint")} />
            </Field>
          </div>

          <Controller
            control={form.control}
            name="requiresPrescription"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
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
                <Switch checked={!!field.value} onCheckedChange={(v) => field.onChange(v)} />
              </label>
            )}
          />

          {!isEdit ? (
            <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm font-medium">Opening stock (optional)</p>
              <Field label="Supplier">
                <select
                  value={stock.supplier}
                  onChange={(e) => setStock((s) => ({ ...s, supplier: e.target.value }))}
                  className="h-9 rounded-md border bg-transparent px-3 text-sm"
                >
                  <option value="">— none —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity">
                  <Input
                    type="number"
                    min="0"
                    value={stock.qty}
                    onChange={(e) => setStock((s) => ({ ...s, qty: e.target.value }))}
                  />
                </Field>
                <Field label="Unit cost (₱)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stock.cost}
                    onChange={(e) => setStock((s) => ({ ...s, cost: e.target.value }))}
                  />
                </Field>
                <Field label="Batch number">
                  <Input
                    value={stock.batch}
                    onChange={(e) => setStock((s) => ({ ...s, batch: e.target.value }))}
                    placeholder="optional"
                  />
                </Field>
                <Field label="Expiry date">
                  <Input
                    type="date"
                    value={stock.expiry}
                    onChange={(e) => setStock((s) => ({ ...s, expiry: e.target.value }))}
                  />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Received into the active branch as the product&apos;s first batch.
              </p>
            </div>
          ) : null}

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
