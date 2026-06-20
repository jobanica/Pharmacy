"use client";

import * as React from "react";
import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Star, UserPlus } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { CustomerDialog, type CustomerRecord } from "./customer-dialog";
import { formatManila } from "@/lib/date";

export type CustomerRow = CustomerRecord & {
  points_balance: number;
  created_at: string;
};

const columns: ColumnDef<CustomerRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <Link href={`/customers/${row.original.id}`} className="font-medium hover:underline">
        {row.original.name}
      </Link>
    ),
  },
  { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
  { accessorKey: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
  {
    accessorKey: "created_at",
    header: "Joined",
    cell: ({ row }) => formatManila(row.original.created_at, "MMM d, yyyy"),
  },
  {
    accessorKey: "points_balance",
    header: "Points",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
        <Star className="size-3.5" />
        {row.original.points_balance}
      </span>
    ),
  },
];

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search by name, phone, or email…"
      emptyMessage="No customers yet."
      toolbar={
        <CustomerDialog
          trigger={
            <Button>
              <UserPlus className="size-4" />
              Add customer
            </Button>
          }
        />
      }
    />
  );
}
