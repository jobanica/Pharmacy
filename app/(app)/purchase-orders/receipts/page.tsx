import Link from "next/link";
import { ArrowLeft, FileImage } from "lucide-react";

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
import { createServiceClient } from "@/lib/supabase/service";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";

export default async function ScannedReceiptsPage() {
  await requireAppContext();
  const supabase = await createClient();

  const { data: scans } = await supabase
    .from("receipt_scans")
    .select("id, image_path, item_count, total_cost_centavos, created_at, suppliers(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  // Sign the private image paths so they can be viewed.
  const service = createServiceClient();
  const rows = await Promise.all(
    (scans ?? []).map(async (s) => {
      let url: string | null = null;
      if (s.image_path) {
        const { data } = await service.storage
          .from("receipts")
          .createSignedUrl(s.image_path, 60 * 60);
        url = data?.signedUrl ?? null;
      }
      return {
        id: s.id,
        supplierName: (s as { suppliers: { name: string } | null }).suppliers?.name ?? "—",
        itemCount: s.item_count,
        total: s.total_cost_centavos,
        createdAt: s.created_at,
        url,
      };
    }),
  );

  return (
    <div>
      <Link
        href="/purchase-orders"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to purchase orders
      </Link>
      <PageHeader
        title="Scanned receipts"
        description="Every supplier receipt scanned into inventory is saved here for reference."
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total cost</TableHead>
              <TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {formatManila(r.createdAt, "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="font-medium">{r.supplierName}</TableCell>
                  <TableCell>{r.itemCount}</TableCell>
                  <TableCell>{formatCentavos(r.total)}</TableCell>
                  <TableCell>
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-fuchsia-400 hover:underline"
                      >
                        <FileImage className="size-4" />
                        View
                      </a>
                    ) : (
                      <span className="text-muted-foreground">No image</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No scanned receipts yet. Use “Scan receipt” in Inventory to add one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
