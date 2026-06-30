"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importProductsCsv, type ImportRow } from "@/lib/catalog/actions";

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, commas, and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  // Normalize newlines and strip a UTF-8 BOM.
  const s = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Flush the last field/row if the file doesn't end with a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// Maps various accepted header spellings to our ImportRow keys.
const HEADER_MAP: Record<string, keyof ImportRow> = {
  name: "name",
  "product name": "name",
  product: "name",
  generic: "genericName",
  "generic name": "genericName",
  genericname: "genericName",
  category: "category",
  sku: "sku",
  barcode: "barcode",
  unit: "unit",
  price: "price",
  "selling price": "price",
  "reorder point": "reorderPoint",
  reorderpoint: "reorderPoint",
  reorder: "reorderPoint",
  "requires prescription": "requiresPrescription",
  prescription: "requiresPrescription",
  rx: "requiresPrescription",
};

function rowsToImport(grid: string[][]): { rows: ImportRow[]; error?: string } {
  if (grid.length < 2) return { rows: [], error: "The file needs a header row and at least one product." };
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const keys = header.map((h) => HEADER_MAP[h]);
  if (!keys.includes("name")) {
    return { rows: [], error: 'No "name" column found. The first row must be a header with a Name column.' };
  }
  const rows: ImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const obj: ImportRow = {};
    keys.forEach((k, idx) => {
      if (k) obj[k] = (cells[idx] ?? "").trim() as never;
    });
    if ((obj.name ?? "").toString().trim()) rows.push(obj);
  }
  return { rows };
}

const TEMPLATE =
  "name,generic_name,category,sku,barcode,unit,price,reorder_point,requires_prescription\n" +
  "Biogesic 500mg,Paracetamol,Pain Relief,BIO500,4801234567890,piece,5.50,20,no\n" +
  "Amoxicillin 500mg,Amoxicillin,Antibiotics,AMOX500,,capsule,12.00,30,yes\n";

export function ImportCsvDialog({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [importing, startImport] = React.useTransition();
  const [report, setReport] = React.useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]);
    setFileName("");
    setReport(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReport(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const grid = parseCsv(text);
      const { rows: parsed, error } = rowsToImport(grid);
      if (error) {
        toast.error(error);
        setRows([]);
        setFileName("");
        return;
      }
      if (parsed.length === 0) {
        toast.error("No product rows found in the file.");
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function submit() {
    startImport(async () => {
      const res = await importProductsCsv(rows);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setReport({ created: res.created, skipped: res.skipped, errors: res.errors });
      if (res.created > 0) {
        toast.success(`Imported ${res.created} product${res.created !== 1 ? "s" : ""}.`);
        router.refresh();
      } else {
        toast.error("No products were imported. Check the errors below.");
      }
    });
  }

  const preview = rows.slice(0, 8);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Import products from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV with a header row. Required column: <code>name</code>. Optional:
            generic_name, category, sku, barcode, unit, price, reorder_point,
            requires_prescription. Categories are created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="size-4" />
              Download template
            </Button>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground hover:bg-muted/40">
            <Upload className="size-6" />
            <span className="font-medium text-foreground">
              {fileName || "Tap to choose a .csv file"}
            </span>
            <span>Comma-separated values, UTF-8.</span>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
            />
          </label>

          {rows.length > 0 && !report ? (
            <div className="grid gap-2">
              <p className="text-sm font-medium">
                {rows.length} product{rows.length !== 1 ? "s" : ""} ready to import
                {rows.length > preview.length ? ` (showing first ${preview.length})` : ""}
              </p>
              <div className="max-h-56 overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 text-left text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5">Category</th>
                      <th className="px-2 py-1.5">Unit</th>
                      <th className="px-2 py-1.5 text-right">Price</th>
                      <th className="px-2 py-1.5 text-right">Reorder</th>
                      <th className="px-2 py-1.5 text-center">Rx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5">{r.name?.toString()}</td>
                        <td className="px-2 py-1.5">{r.category?.toString() || "—"}</td>
                        <td className="px-2 py-1.5">{r.unit?.toString() || "piece"}</td>
                        <td className="px-2 py-1.5 text-right">{r.price?.toString() || "0"}</td>
                        <td className="px-2 py-1.5 text-right">{r.reorderPoint?.toString() || "0"}</td>
                        <td className="px-2 py-1.5 text-center">
                          {["yes", "true", "1", "y"].includes((r.requiresPrescription ?? "").toString().trim().toLowerCase()) ? "✓" : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {report ? (
            <div className="grid gap-2 rounded-lg border p-3 text-sm">
              <p>
                <span className="font-medium text-emerald-600 dark:text-emerald-500">
                  {report.created} imported
                </span>
                {report.skipped > 0 ? (
                  <span className="text-muted-foreground"> · {report.skipped} skipped</span>
                ) : null}
              </p>
              {report.errors.length > 0 ? (
                <div className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                  {report.errors.map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {report ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <Button onClick={submit} disabled={importing || rows.length === 0}>
              {importing ? <Loader2 className="size-4 animate-spin" /> : null}
              Import {rows.length > 0 ? rows.length : ""} product{rows.length !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
