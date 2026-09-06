"use client";

import { CsvExportButton, type CsvColumn } from "@/components/alerts/csv-export-button";

export type DonationCsvRow = {
  date: string;
  product: string;
  quantity: number;
  cost: string;
  details: string;
};

const COLUMNS: CsvColumn<DonationCsvRow>[] = [
  { header: "Date", value: (r) => r.date },
  { header: "Product", value: (r) => r.product },
  { header: "Quantity", value: (r) => r.quantity },
  { header: "Cost", value: (r) => r.cost },
  { header: "Recipient / notes", value: (r) => r.details },
];

export function DonationsCsvButton({ rows }: { rows: DonationCsvRow[] }) {
  return <CsvExportButton rows={rows} columns={COLUMNS} filename="donations.csv" />;
}
