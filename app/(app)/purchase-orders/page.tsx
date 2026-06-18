import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PoStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCentavos } from "@/lib/money";
import type { PoStatus } from "@/lib/supabase/types";

export default async function PurchaseOrdersPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: pos } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, status, expected_date, supplier_id, suppliers(name), purchase_order_items(quantity_ordered, unit_cost_centavos)",
    )
    .order("created_at", { ascending: false });

  const rows = (pos ?? []).map((po) => {
    const items =
      (po as { purchase_order_items: { quantity_ordered: number; unit_cost_centavos: number }[] })
        .purchase_order_items ?? [];
    const total = items.reduce((s, it) => s + it.quantity_ordered * it.unit_cost_centavos, 0);
    const supplier = (po as { suppliers: { name: string } | null }).suppliers;
    return { ...po, itemCount: items.length, total, supplierName: supplier?.name ?? "—" };
  });

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Order stock from suppliers and receive it into inventory."
        action={
          <Button render={<Link href="/purchase-orders/new" />}>
            <Plus className="size-4" />
            New PO
          </Button>
        }
      />
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Est. total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((po) => (
                <TableRow key={po.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/purchase-orders/${po.id}`} className="hover:underline">
                      {po.po_number}
                    </Link>
                  </TableCell>
                  <TableCell>{po.supplierName}</TableCell>
                  <TableCell>
                    <PoStatusBadge status={po.status as PoStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {po.expected_date ?? "—"}
                  </TableCell>
                  <TableCell>{po.itemCount}</TableCell>
                  <TableCell>{formatCentavos(po.total)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No purchase orders yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
