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
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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

  // Owners see every branch's POs; everyone else is scoped to their active
  // branch and cannot see other branches' purchase orders.
  const isOwner = ctx.role === "owner";
  const activeBranchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "this branch";

  let query = supabase
    .from("purchase_orders")
    .select(
      "id, po_number, status, expected_date, supplier_id, branch_id, suppliers(name), branches(name), purchase_order_items(quantity_ordered, unit_cost_centavos)",
    )
    .order("created_at", { ascending: false });
  if (!isOwner) query = query.eq("branch_id", ctx.activeBranchId);
  const { data: pos } = await query;

  const rows = (pos ?? []).map((po) => {
    const items =
      (po as { purchase_order_items: { quantity_ordered: number; unit_cost_centavos: number }[] })
        .purchase_order_items ?? [];
    const total = items.reduce((s, it) => s + it.quantity_ordered * it.unit_cost_centavos, 0);
    const supplier = (po as { suppliers: { name: string } | null }).suppliers;
    const branch = (po as { branches: { name: string } | null }).branches;
    return {
      ...po,
      itemCount: items.length,
      total,
      supplierName: supplier?.name ?? "—",
      branchName: branch?.name ?? "—",
    };
  });

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description={
          isOwner
            ? "Order stock from suppliers and receive it into inventory. Showing all branches."
            : `Order stock from suppliers and receive it into inventory. Showing ${activeBranchName} only.`
        }
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
              {isOwner ? <TableHead>Branch</TableHead> : null}
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
                  {isOwner ? <TableCell>{po.branchName}</TableCell> : null}
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
                <TableCell colSpan={isOwner ? 7 : 6} className="h-24 text-center text-muted-foreground">
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
