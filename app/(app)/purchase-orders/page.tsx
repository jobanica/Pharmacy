import Link from "next/link";
import { Plus, FileImage } from "lucide-react";

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
import { DeletePoButton } from "@/components/purchase-orders/delete-po-button";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import type { PoStatus } from "@/lib/supabase/types";
import { canUseInventory } from "@/lib/billing/plans";
import { PlanUpsell } from "@/components/billing/plan-upsell";

export default async function PurchaseOrdersPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();

  if (!canUseInventory(ctx.organization.plan)) {
    return (
      <div className="grid gap-4">
        <PlanUpsell
          title="Purchase Orders"
          description="Create and manage supplier purchase orders, receive stock, and track deliveries. Available on the Starter plan and above."
        />
      </div>
    );
  }

  // Purchase orders are per-branch: show only the active branch's POs. Switch
  // branches with the top selector to see another branch's orders.
  const canManage = can(ctx.role, "use_purchase_orders");
  const activeBranchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "this branch";

  const { data: pos } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, status, expected_date, supplier_id, branch_id, suppliers(name), branches(name), purchase_order_items(quantity_ordered, quantity_received, unit_cost_centavos)",
    )
    .eq("branch_id", ctx.activeBranchId)
    .order("created_at", { ascending: false });

  const rows = (pos ?? []).map((po) => {
    const items =
      (po as {
        purchase_order_items: {
          quantity_ordered: number;
          quantity_received: number;
          unit_cost_centavos: number;
        }[];
      }).purchase_order_items ?? [];
    const total = items.reduce((s, it) => s + it.quantity_ordered * it.unit_cost_centavos, 0);
    const supplier = (po as { suppliers: { name: string } | null }).suppliers;
    return {
      ...po,
      itemCount: items.length,
      total,
      supplierName: supplier?.name ?? "—",
      // A PO with no received units can be safely deleted.
      received: items.some((it) => it.quantity_received > 0),
    };
  });

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description={`Order stock from suppliers and receive it into inventory. Showing ${activeBranchName} only.`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" render={<Link href="/purchase-orders/receipts" />}>
              <FileImage className="size-4" />
              Scanned receipts
            </Button>
            <Button render={<Link href="/purchase-orders/new" />}>
              <Plus className="size-4" />
              New PO
            </Button>
          </div>
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
              {canManage ? <TableHead /> : null}
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
                  {canManage ? (
                    <TableCell className="text-right">
                      <DeletePoButton poId={po.id} poNumber={po.po_number} received={po.received} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6} className="h-24 text-center text-muted-foreground">
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
