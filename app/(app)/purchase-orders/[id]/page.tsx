import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PoStatusBadge } from "@/components/purchase-orders/po-status-badge";
import { PrintButton } from "@/components/pos/print-button";
import { ScanReceiveDialog } from "@/components/purchase-orders/scan-receive-dialog";
import { aiReceiptEnabled } from "@/lib/ai/receipt";
import {
  HeaderEditor,
  AddItemForm,
  StatusButton,
  ReceiveDialog,
  ReverseReceivingButton,
  EditablePoItemRow,
  DownloadPoCsvButton,
} from "@/components/purchase-orders/po-controls";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import type { PoStatus } from "@/lib/supabase/types";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "use_purchase_orders");

  const { data: po } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_number, status, expected_date, notes, supplier_id, branch_id, suppliers(name), branches(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!po) notFound();

  const status = po.status as PoStatus;
  const isDraft = status === "draft";
  const isSent = status === "sent";

  const [{ data: items }, suppliersRes, productsRes] = await Promise.all([
    supabase
      .from("purchase_order_items")
      .select("id, product_id, quantity_ordered, quantity_received, unit_cost_centavos, products(name)")
      .eq("purchase_order_id", id)
      .order("created_at"),
    isDraft && canManage
      ? supabase.from("suppliers").select("id, name").order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    isDraft && canManage
      ? supabase.from("products").select("id, name").eq("is_active", true).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const rows = (items ?? []).map((it) => ({
    ...it,
    name: (it as { products: { name: string } | null }).products?.name ?? "—",
    lineTotal: it.quantity_ordered * it.unit_cost_centavos,
  }));
  const total = rows.reduce((s, r) => s + r.lineTotal, 0);
  const hasReceived = rows.some((r) => r.quantity_received > 0);
  const supplierName = (po as { suppliers: { name: string } | null }).suppliers?.name ?? "—";
  const branchName = (po as { branches: { name: string } | null }).branches?.name ?? "—";

  return (
    <div className="grid gap-6">
      <div className="print:hidden">
        <Link
          href="/purchase-orders"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to purchase orders
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            {po.po_number}
            <PoStatusBadge status={status} />
          </h1>
          <div className="flex gap-2">
            <PrintButton />
            <DownloadPoCsvButton
              poNumber={po.po_number}
              supplier={supplierName}
              branch={branchName}
              items={rows.map((r) => ({
                id: r.id,
                name: r.name,
                quantity_ordered: r.quantity_ordered,
                quantity_received: r.quantity_received,
                unit_cost_centavos: r.unit_cost_centavos,
              }))}
            />
            {canManage ? (
              <>
                {isDraft ? (
                <>
                  <StatusButton poId={po.id} to="cancelled" />
                  <StatusButton poId={po.id} to="sent" />
                </>
              ) : null}
              {isSent ? (
                <>
                  <StatusButton poId={po.id} to="cancelled" />
                  <ScanReceiveDialog
                    poId={po.id}
                    aiEnabled={aiReceiptEnabled()}
                    items={rows.map((r) => ({
                      id: r.id,
                      product_id: r.product_id,
                      product_name: r.name,
                      quantity_ordered: r.quantity_ordered,
                      quantity_received: r.quantity_received,
                      unit_cost_centavos: r.unit_cost_centavos,
                    }))}
                  />
                  <ReceiveDialog
                    poId={po.id}
                    items={rows.map((r) => ({
                      id: r.id,
                      product_name: r.name,
                      quantity_ordered: r.quantity_ordered,
                      quantity_received: r.quantity_received,
                      unit_cost_centavos: r.unit_cost_centavos,
                    }))}
                  />
                </>
              ) : null}
              {hasReceived ? <ReverseReceivingButton poId={po.id} /> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="print-area grid gap-6">
        <div className="hidden print:block">
          <div className="text-lg font-bold">{ctx.organization.name}</div>
          <div className="text-sm">
            Purchase Order {po.po_number} · {supplierName} · {branchName}
          </div>
        </div>

      <Card>
        <CardContent className="grid gap-4 p-5 text-sm">
          {isDraft && canManage ? (
            <HeaderEditor
              poId={po.id}
              suppliers={suppliersRes.data ?? []}
              supplierId={po.supplier_id ?? ""}
              expectedDate={po.expected_date ?? ""}
              notes={po.notes ?? ""}
            />
          ) : (
            <div className="grid gap-1 sm:grid-cols-3">
              <Info label="Supplier" value={supplierName} />
              <Info label="Branch" value={branchName} />
              <Info label="Expected" value={po.expected_date ?? "—"} />
              {po.notes ? <Info label="Notes" value={po.notes} /> : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Line total</TableHead>
                {isDraft && canManage ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length > 0 ? (
                rows.map((r) =>
                  isDraft && canManage ? (
                    <EditablePoItemRow
                      key={r.id}
                      poId={po.id}
                      item={{
                        id: r.id,
                        name: r.name,
                        quantity_ordered: r.quantity_ordered,
                        quantity_received: r.quantity_received,
                        unit_cost_centavos: r.unit_cost_centavos,
                      }}
                    />
                  ) : (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{r.quantity_ordered}</TableCell>
                      <TableCell>{r.quantity_received}</TableCell>
                      <TableCell>{formatCentavos(r.unit_cost_centavos)}</TableCell>
                      <TableCell>{formatCentavos(r.lineTotal)}</TableCell>
                    </TableRow>
                  ),
                )
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                    No items.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {isDraft && canManage ? (
            <AddItemForm poId={po.id} products={productsRes.data ?? []} />
          ) : null}

          <div className="flex justify-end border-t pt-3 text-sm font-semibold">
            Total: <span className="ml-2">{formatCentavos(total)}</span>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
