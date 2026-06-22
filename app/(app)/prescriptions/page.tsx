import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function PrescriptionsPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: prescriptions } = await supabase
    .from("prescriptions")
    .select("id, rx_number, patient_name, patient_dob, doctor_name, doctor_prc_no, date_issued, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // Look up the sale linked to each prescription (FK lives on sales.prescription_id).
  const { data: linkedSales } = (prescriptions ?? []).length > 0
    ? await supabase
        .from("sales")
        .select("id, receipt_number, prescription_id")
        .in("prescription_id", (prescriptions ?? []).map((p) => p.id))
    : { data: [] as { id: string; receipt_number: string; prescription_id: string | null }[] };

  const saleByRx = new Map(
    (linkedSales ?? []).map((s) => [s.prescription_id!, { id: s.id, receiptNo: s.receipt_number }]),
  );
  const rows = prescriptions ?? [];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Prescriptions"
        description="Rx records retained per RA 9165. Minimum 2-year retention required."
      />

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>DOB</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>PRC No.</TableHead>
              <TableHead>Rx / Control No.</TableHead>
              <TableHead>OR No.</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const sale = saleByRx.get(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatManila(r.created_at)}</TableCell>
                  <TableCell className="font-medium">{r.patient_name}</TableCell>
                  <TableCell className="text-xs">{r.patient_dob ?? "—"}</TableCell>
                  <TableCell>{r.doctor_name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.doctor_prc_no ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.rx_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{sale?.receiptNo ?? "—"}</TableCell>
                  <TableCell>
                    {sale ? (
                      <Link
                        href={`/pos/receipt/${sale.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {(rows ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No prescriptions recorded yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
