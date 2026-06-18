"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export type CsvColumn<T> = { header: string; value: (row: T) => string | number };

function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = columns.map((c) => escape(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escape(c.value(r))).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

export function CsvExportButton<T>({
  rows,
  columns,
  filename,
}: {
  rows: T[];
  columns: CsvColumn<T>[];
  filename: string;
}) {
  function download() {
    const csv = toCsv(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download} disabled={rows.length === 0}>
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}
