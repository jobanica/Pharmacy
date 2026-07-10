"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Printer } from "lucide-react";
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
  if (days <= 60) return { label: "31–60 days", tone: "text-amber-600 dark:text-amber-500" };
  return { label: "61–90 days", tone: "text-muted-foreground" };
}

type FilterKey = "all" | "expired" | "d30" | "d60" | "d90";

const FILTERS: {
  key: FilterKey;
  label: string;
  tone: string;
  test: (days: number) => boolean;
}[] = [
  { key: "all", label: "All", tone: "text-foreground", test: () => true },
  { key: "expired", label: "Expired", tone: "text-destructive", test: (d) => d < 0 },
  { key: "d30", label: "≤30 days", tone: "text-destructive", test: (d) => d >= 0 && d <= 30 },
  { key: "d60", label: "31–60 days", tone: "text-amber-600 dark:text-amber-500", test: (d) => d > 30 && d <= 60 },
  { key: "d90", label: "61–90 days", tone: "text-muted-foreground", test: (d) => d > 60 && d <= 90 },
];

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
        if (
          !window.confirm(
            "Write off this batch as EXPIRED? Its stock is removed and the loss cost is recorded in Stock Adjustments.",
          )
        )
          return;
        startTransition(async () => {
          const res = await writeOffBatch(batchId);
          if ("error" in res) toast.error(res.error);
          else {
            toast.success("Batch written off as expired");
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
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const filtered = React.useMemo(
    () => rows.filter((r) => active.test(r.days_until)),
    [rows, active],
  );

  const printedAt = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="grid gap-3">
      {/* Clickable filter buckets — tap one, then print to separate that pile. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 print:hidden">
        {FILTERS.map((f) => (
          <Bucket
            key={f.key}
            label={f.label}
            value={rows.filter((r) => f.test(r.days_until)).length}
            tone={f.tone}
            active={f.key === filter}
            onClick={() => setFilter(f.key)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{active.label}</span> —{" "}
          {filtered.length} batch(es).
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print
          </Button>
          <CsvExportButton
            rows={filtered}
            filename={`expiring-stock-${active.label}-${branchName}.csv`}
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
      </div>

      {/* print-area: the only thing that shows on the printout (see globals.css). */}
      <div className="rounded-lg border print-area">
        <div className="hidden p-4 print:block">
          <h2 className="text-lg font-bold">Expiring stock — {active.label}</h2>
          <p className="text-sm">
            {branchName} · {filtered.length} batch(es) · Printed {printedAt}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Qty</TableHead>
              {canManage ? <TableHead className="print:hidden" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? (
              filtered.map((r) => {
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
                      <TableCell className="text-right print:hidden">
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
                  No batches in “{active.label}”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Bucket({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card
        className={
          active
            ? "border-primary ring-1 ring-primary"
            : "transition-colors hover:border-primary/50"
        }
      >
        <CardContent className="p-4">
          <div className={`text-2xl font-semibold ${tone}`}>{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </button>
  );
}
