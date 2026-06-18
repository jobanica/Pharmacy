"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CsvExportButton } from "./csv-export-button";
import { CreatePoButton } from "./create-po-button";

export type LowStockRow = {
  product_id: string;
  product_name: string;
  unit: string;
  on_hand: number;
  reorder_point: number;
  deficit: number;
};

export function LowStockTable({
  rows,
  branchName,
  canManage,
}: {
  rows: LowStockRow[];
  branchName: string;
  canManage: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.length} product(s) at or below reorder point.
        </p>
        <div className="flex gap-2">
          {canManage && rows.length > 0 ? <CreatePoButton /> : null}
          <CsvExportButton
          rows={rows}
          filename={`low-stock-${branchName}.csv`}
          columns={[
            { header: "Product", value: (r) => r.product_name },
            { header: "Unit", value: (r) => r.unit },
            { header: "On hand", value: (r) => r.on_hand },
            { header: "Reorder point", value: (r) => r.reorder_point },
            { header: "Suggested order", value: (r) => r.deficit },
          ]}
          />
        </div>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>On hand</TableHead>
              <TableHead>Reorder pt</TableHead>
              <TableHead>Suggested order</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <TableRow key={r.product_id}>
                  <TableCell className="font-medium">{r.product_name}</TableCell>
                  <TableCell className="text-amber-600 dark:text-amber-500">
                    {r.on_hand} {r.unit}
                  </TableCell>
                  <TableCell>{r.reorder_point}</TableCell>
                  <TableCell className="font-medium">{r.deficit}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                  Everything is above its reorder point. 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
