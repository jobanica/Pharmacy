import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date/index";
import { formatCentavos } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { ReceiveTransferButton } from "@/components/inventory/receive-transfer-button";

const STATUS_LABEL: Record<string, string> = {
  in_transit: "In Transit",
  received: "Received",
  cancelled: "Cancelled",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_transit: "default",
  received: "secondary",
  cancelled: "destructive",
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const { transferId } = await params;
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: xfer } = await supabase
    .from("stock_transfers")
    .select("id, from_branch_id, to_branch_id, status, notes, created_at, received_at, created_by, received_by")
    .eq("id", transferId)
    .maybeSingle();

  if (!xfer) notFound();

  const { data: items } = await supabase
    .from("stock_transfer_items")
    .select("product_id, quantity, unit_cost_centavos")
    .eq("transfer_id", transferId);

  const productIds = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, name, unit").in("id", productIds)
    : { data: [] };
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  const [{ data: fromBranch }, { data: toBranch }] = await Promise.all([
    supabase.from("branches").select("name").eq("id", xfer.from_branch_id).maybeSingle(),
    supabase.from("branches").select("name").eq("id", xfer.to_branch_id).maybeSingle(),
  ]);

  const isDestination = ctx.activeBranchId === xfer.to_branch_id;
  const canReceive = isDestination && xfer.status === "in_transit" && can(ctx.role, "manage_catalog");

  const totalUnits = (items ?? []).reduce((s, i) => s + i.quantity, 0);
  const totalCost = (items ?? []).reduce((s, i) => s + i.quantity * i.unit_cost_centavos, 0);

  return (
    <div className="space-y-5 p-6 max-w-3xl">
      <Link
        href="/inventory/transfers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to transfers
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Transfer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fromBranch?.name ?? "—"} → {toBranch?.name ?? "—"} · {formatManila(xfer.created_at)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[xfer.status] ?? "outline"}>
          {STATUS_LABEL[xfer.status] ?? xfer.status}
        </Badge>
      </div>

      {xfer.notes ? (
        <p className="text-sm text-muted-foreground rounded-md border px-3 py-2">{xfer.notes}</p>
      ) : null}

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit cost</th>
              <th className="px-3 py-2 text-right">Total cost</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it, i) => {
              const prod = productMap.get(it.product_id);
              return (
                <tr key={i} className="border-t">
                  <td className="px-3 py-2">{prod?.name ?? it.product_id}</td>
                  <td className="px-3 py-2 text-right">{it.quantity} {prod?.unit ?? ""}</td>
                  <td className="px-3 py-2 text-right">{formatCentavos(it.unit_cost_centavos)}</td>
                  <td className="px-3 py-2 text-right">{formatCentavos(it.quantity * it.unit_cost_centavos)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30 text-xs font-semibold">
            <tr>
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{totalUnits} units</td>
              <td />
              <td className="px-3 py-2 text-right">{formatCentavos(totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {xfer.received_at ? (
        <p className="text-sm text-muted-foreground">
          Received {formatManila(xfer.received_at)}
        </p>
      ) : null}

      {canReceive ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This transfer is addressed to your branch. Confirm receipt to add the stock.
          </p>
          <ReceiveTransferButton transferId={transferId} />
        </div>
      ) : null}
    </div>
  );
}
