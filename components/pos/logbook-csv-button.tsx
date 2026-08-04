"use client";

import { CsvExportButton, type CsvColumn } from "@/components/alerts/csv-export-button";

export type LogbookCsvRow = {
  date: string;
  orNo: string;
  type: string;
  beneficiary: string;
  idNo: string;
  gross: string;
  discount: string;
  net: string;
};

const COLUMNS: CsvColumn<LogbookCsvRow>[] = [
  { header: "Date", value: (r) => r.date },
  { header: "OR No.", value: (r) => r.orNo },
  { header: "Type", value: (r) => r.type },
  { header: "Beneficiary", value: (r) => r.beneficiary },
  { header: "ID No.", value: (r) => r.idNo },
  { header: "Gross", value: (r) => r.gross },
  { header: "Discount", value: (r) => r.discount },
  { header: "Net", value: (r) => r.net },
];

export function LogbookCsvButton({ rows, filename }: { rows: LogbookCsvRow[]; filename: string }) {
  return <CsvExportButton rows={rows} columns={COLUMNS} filename={filename} />;
}
