import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PrintLink } from "@/components/pos/print-button";
import { LogbookCsvButton, type LogbookCsvRow } from "@/components/pos/logbook-csv-button";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function LogbookPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const branchName = ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  // Per-branch logbook: only this branch's SC/PWD transactions.
  const { data: sales } = await supabase
    .from("sales")
    .select(
      "id, receipt_number, created_at, discount_type, beneficiary_name, beneficiary_id_no, subtotal_centavos, discount_centavos, total_centavos, branch_id",
    )
    .eq("branch_id", ctx.activeBranchId)
    .in("discount_type", ["sc", "pwd"])
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(500);

  const csvRows: LogbookCsvRow[] = (sales ?? []).map((s) => ({
    date: formatManila(s.created_at),
    orNo: String(s.receipt_number),
    type: (s.discount_type ?? "").toUpperCase(),
    beneficiary: s.beneficiary_name ?? "",
    idNo: s.beneficiary_id_no ?? "",
    gross: (s.subtotal_centavos / 100).toFixed(2),
    discount: (s.discount_centavos / 100).toFixed(2),
    net: (s.total_centavos / 100).toFixed(2),
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="SC / PWD Logbook"
        description={`${branchName} — required transaction record per RA 9994 and RA 10754. Keep printed copies on file.`}
        action={
          <LogbookCsvButton
            rows={csvRows}
            filename={`sc-pwd-logbook-${branchName.replace(/\s+/g, "-").toLowerCase()}.csv`}
          />
        }
      />

      <Link
        href="/pos"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to POS
      </Link>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>OR No.</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Beneficiary</TableHead>
              <TableHead>ID No.</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sales ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-xs">{formatManila(s.created_at)}</TableCell>
                <TableCell className="font-mono text-sm">{s.receipt_number}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-amber-400">
                    {s.discount_type?.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell>{s.beneficiary_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{s.beneficiary_id_no ?? "—"}</TableCell>
                <TableCell className="text-right">{formatCentavos(s.subtotal_centavos)}</TableCell>
                <TableCell className="text-right text-amber-400">
                  -{formatCentavos(s.discount_centavos)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCentavos(s.total_centavos)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/pos/receipt/${s.id}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {(sales ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                  No SC/PWD transactions yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing last 500 records for {branchName}. Use your browser&apos;s print function to produce a hard copy.{" "}
        <PrintLink />
      </p>
    </div>
  );
}
