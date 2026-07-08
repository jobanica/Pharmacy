"use client";

import { CsvExportButton, type CsvColumn } from "@/components/alerts/csv-export-button";

export type TransferListCsvRow = {
  direction: string;
  date: string;
  counterparty: string;
  notes: string;
  status: string;
};

// Defined here (a client component) so the function-valued columns never cross
// the server→client boundary — passing them from a Server Component throws.
const COLUMNS: CsvColumn<TransferListCsvRow>[] = [
  { header: "Direction", value: (r) => r.direction },
  { header: "Date", value: (r) => r.date },
  { header: "Branch", value: (r) => r.counterparty },
  { header: "Notes", value: (r) => r.notes },
  { header: "Status", value: (r) => r.status },
];

export function TransfersCsvButton({ rows }: { rows: TransferListCsvRow[] }) {
  return <CsvExportButton rows={rows} columns={COLUMNS} filename="stock-transfers.csv" />;
}
