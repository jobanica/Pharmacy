"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CsvExportButton } from "./csv-export-button";
import { writeOffBatch } from "@/lib/alerts/actions";

export type ExpiringRow = {
  batch_id: string;
  product_name: string;
  unit: string;
  batch_number: string | null;
  expiry_date: string;
  quantity: number;
  days_until: number;
  supplier_name: string | null;
};

function bucket(days: number): { label: string; tone: string } {
  if (days < 0) return { label: "Expired", tone: "text-destructive" };
  if (days <= 30) return { label: "≤30 days", tone: "text-destructive" };
  if (days <= 60) return { label: "≤60 days", tone: "text-amber-600 dark:text-amber-500" };
  return { label: "≤90 days", tone: "text-muted-foreground" };
}

function WriteOffButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Write off this batch? It will be removed from on-hand stock.")) return;
        startTransition(async () => {
          const res = await writeOffBatch(batchId, "Expired stock");
          if ("error" in res) toast.error(res.error);
          else {
            toast.success("Batch written off");
            router.refresh();
          }
        });
      }}
    >
      <Trash2 className="size-4" />
      Write off
    </Button>
  );
}

export function ExpiringTable({
  rows,
  branchName,
  canManage,
}: {
  rows: ExpiringRow[];
  branchName: string;
  canManage: boolean;
}) {
  const counts = {
    expired: rows.filter((r) => r.days_until < 0).length,
    d30: rows.filter((r) => r.days_until >= 0 && r.days_until <= 30).length,
    d60: rows.filter((r) => r.days_until > 30 && r.days_until <= 60).length,
    d90: rows.filter((r) => r.days_until > 60 && r.days_until <= 90).length,
  };

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Bucket label="Expired" value={counts.expired} tone="text-destructive" />
        <Bucket label="≤30 days" value={counts.d30} tone="text-destructive" />
        <Bucket label="≤60 days" value={counts.d60} tone="text-amber-600 dark:text-amber-500" />
        <Bucket label="≤90 days" value={counts.d90} tone="text-foreground" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} batch(es) expiring within 90 days.
        </p>
        <CsvExportButton
          rows={rows}
          filename={`expiring-stock-${branchName}.csv`}
          columns={[
            { header: "Product", value: (r) => r.product_name },
            { header: "Supplier", value: (r) => r.supplier_name ?? "" },
            { header: "Batch", value: (r) => r.batch_number ?? "" },
            { header: "Expiry", value: (r) => r.expiry_date },
            { header: "Days until", value: (r) => r.days_until },
            { header: "Quantity", value: (r) => r.quantity },
            { header: "Unit", value: (r) => r.unit },
          ]}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Qty</TableHead>
              {canManage ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((r) => {
                const b = bucket(r.days_until);
                return (
                  <TableRow key={r.batch_id}>
                    <TableCell className="font-medium">{r.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.supplier_name ?? "—"}</TableCell>
                    <TableCell>{r.batch_number ?? "—"}</TableCell>
                    <TableCell>{r.expiry_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={b.tone}>
                        {b.label}
                        {r.days_until >= 0 ? ` (${r.days_until}d)` : ""}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.quantity} {r.unit}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <WriteOffButton batchId={r.batch_id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 7 : 6}
                  className="h-20 text-center text-muted-foreground"
                >
                  No stock expiring within 90 days. 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Bucket({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
