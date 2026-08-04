"use client";

import { CsvExportButton, type CsvColumn } from "@/components/alerts/csv-export-button";

export type AdjustmentCsvRow = {
  date: string;
  product: string;
  reason: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
  notes: string;
};

// Column defs (with value functions) live in this client component so they
// never cross the server→client boundary.
const COLUMNS: CsvColumn<AdjustmentCsvRow>[] = [
  { header: "Date", value: (r) => r.date },
  { header: "Product", value: (r) => r.product },
  { header: "Reason", value: (r) => r.reason },
  { header: "Quantity", value: (r) => r.quantity },
  { header: "Unit cost", value: (r) => r.unitCost },
  { header: "Total cost", value: (r) => r.totalCost },
  { header: "Notes", value: (r) => r.notes },
];

export function AdjustmentsCsvButton({ rows }: { rows: AdjustmentCsvRow[] }) {
  return <CsvExportButton rows={rows} columns={COLUMNS} filename="stock-adjustments.csv" />;
}
