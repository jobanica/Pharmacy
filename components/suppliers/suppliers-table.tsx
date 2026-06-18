"use client";

import * as React from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { SupplierDialog, type SupplierRow } from "./supplier-dialog";
import { deleteSupplier } from "@/lib/catalog/actions";

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await deleteSupplier(id);
          if ("error" in res) toast.error(res.error);
          else {
            toast.success("Supplier removed");
            router.refresh();
          }
        })
      }
    >
      <Trash2 className="size-4" />
    </Button>
  );
}

function buildColumns(canManage: boolean): ColumnDef<SupplierRow>[] {
  const cols: ColumnDef<SupplierRow>[] = [
    { accessorKey: "name", header: "Supplier" },
    {
      accessorKey: "contact_person",
      header: "Contact",
      cell: ({ row }) => row.original.contact_person ?? "—",
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email ?? "—",
    },
  ];

  if (canManage) {
    cols.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <SupplierDialog
            supplier={row.original}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="size-4" />
              </Button>
            }
          />
          <DeleteButton id={row.original.id} />
        </div>
      ),
    });
  }

  return cols;
}

export function SuppliersTable({
  suppliers,
  canManage,
}: {
  suppliers: SupplierRow[];
  canManage: boolean;
}) {
  const columns = React.useMemo(() => buildColumns(canManage), [canManage]);
  return (
    <DataTable
      columns={columns}
      data={suppliers}
      searchPlaceholder="Search suppliers…"
      emptyMessage="No suppliers yet."
      toolbar={
        canManage ? (
          <SupplierDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                Add supplier
              </Button>
            }
          />
        ) : null
      }
    />
  );
}
