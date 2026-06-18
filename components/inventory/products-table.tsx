"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ProductDialog, type ProductRow } from "./product-dialog";
import { setProductActive } from "@/lib/catalog/actions";
import { formatCentavos } from "@/lib/money";

export type ProductWithCategory = ProductRow & {
  category_name: string | null;
  on_hand: number;
};
type CategoryOption = { id: string; name: string };

function ActiveToggle({ product }: { product: ProductWithCategory }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Switch
      checked={product.is_active}
      disabled={pending}
      onCheckedChange={(v) =>
        startTransition(async () => {
          const res = await setProductActive(product.id, v);
          if ("error" in res) toast.error(res.error);
          else router.refresh();
        })
      }
    />
  );
}

function buildColumns(
  categories: CategoryOption[],
  canManage: boolean,
): ColumnDef<ProductWithCategory>[] {
  const cols: ColumnDef<ProductWithCategory>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <div>
          <Link
            href={`/inventory/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
          {row.original.generic_name ? (
            <div className="text-xs text-muted-foreground">
              {row.original.generic_name}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      accessorFn: (r) => r.category_name ?? "",
      id: "category",
      header: "Category",
      cell: ({ row }) =>
        row.original.category_name ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { accessorKey: "sku", header: "SKU", cell: ({ row }) => row.original.sku ?? "—" },
    {
      accessorKey: "barcode",
      header: "Barcode",
      cell: ({ row }) => row.original.barcode ?? "—",
    },
    {
      accessorKey: "default_price_centavos",
      header: "Price",
      cell: ({ row }) => formatCentavos(row.original.default_price_centavos),
    },
    {
      accessorKey: "on_hand",
      header: "On hand",
      cell: ({ row }) => {
        const { on_hand, reorder_point } = row.original;
        const low = reorder_point > 0 && on_hand <= reorder_point;
        return (
          <span
            className={cn(
              "font-medium",
              low ? "text-amber-600 dark:text-amber-500" : undefined,
            )}
            title={low ? "At or below reorder point" : undefined}
          >
            {on_hand}
          </span>
        );
      },
    },
    {
      accessorKey: "reorder_point",
      header: "Reorder pt",
      cell: ({ row }) => row.original.reorder_point,
    },
    {
      id: "rx",
      header: "Rx",
      cell: ({ row }) =>
        row.original.requires_prescription ? (
          <Badge variant="outline">Rx</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Active",
      cell: ({ row }) =>
        canManage ? (
          <ActiveToggle product={row.original} />
        ) : (
          <Badge variant={row.original.is_active ? "secondary" : "outline"}>
            {row.original.is_active ? "Active" : "Inactive"}
          </Badge>
        ),
    },
  ];

  if (canManage) {
    cols.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <ProductDialog
          categories={categories}
          product={row.original}
          trigger={
            <Button variant="ghost" size="sm">
              <Pencil className="size-4" />
            </Button>
          }
        />
      ),
    });
  }

  return cols;
}

export function ProductsTable({
  products,
  categories,
  canManage,
}: {
  products: ProductWithCategory[];
  categories: CategoryOption[];
  canManage: boolean;
}) {
  const [categoryFilter, setCategoryFilter] = React.useState<string>("");
  const columns = React.useMemo(
    () => buildColumns(categories, canManage),
    [categories, canManage],
  );

  const data = React.useMemo(
    () =>
      categoryFilter
        ? products.filter((p) =>
            categoryFilter === "__none__"
              ? !p.category_id
              : p.category_id === categoryFilter,
          )
        : products,
    [products, categoryFilter],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search by name, SKU, or barcode…"
      emptyMessage="No products yet."
      toolbar={
        <>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">All categories</option>
            <option value="__none__">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {canManage ? (
            <ProductDialog
              categories={categories}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add product
                </Button>
              }
            />
          ) : null}
        </>
      }
    />
  );
}
