import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackagePlus, Pencil, Printer } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReceiveStockDialog } from "@/components/inventory/receive-stock-dialog";
import { AdjustBatchDialog } from "@/components/inventory/adjust-batch-dialog";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { formatManila, daysUntil } from "@/lib/date";
import type { MovementType } from "@/lib/supabase/types";

const MOVEMENT_LABELS: Record<MovementType, string> = {
  receive: "Received",
  sale: "Sale",
  adjustment: "Adjustment",
  void: "Void",
  transfer: "Transfer",
  expiry_writeoff: "Expiry write-off",
};

function ExpiryCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">No expiry</span>;
  const days = daysUntil(date);
  let tone = "text-foreground";
  let note = `${days} days`;
  if (days < 0) {
    tone = "text-destructive";
    note = "Expired";
  } else if (days <= 30) {
    tone = "text-amber-600 dark:text-amber-500";
  }
  return (
    <span className={tone}>
      {date} <span className="text-xs">({note})</span>
    </span>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "manage_stock");
  const branchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, generic_name, unit, default_price_centavos, requires_prescription, reorder_point, is_active, categories(name)",
    )
    .eq("id", productId)
    .maybeSingle();

  if (!product) notFound();

  const [{ data: onHandRow }, { data: batches }, { data: movements }, { data: suppliers }] =
    await Promise.all([
      supabase
        .from("v_product_on_hand")
        .select("on_hand")
        .eq("product_id", productId)
        .eq("branch_id", ctx.activeBranchId)
        .maybeSingle(),
      supabase
        .from("batches")
        .select("id, batch_number, expiry_date, quantity, cost_centavos, received_at, suppliers(name)")
        .eq("product_id", productId)
        .eq("branch_id", ctx.activeBranchId)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("inventory_movements")
        .select("id, type, quantity_delta, reason, created_at, created_by")
        .eq("product_id", productId)
        .eq("branch_id", ctx.activeBranchId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("suppliers").select("id, name").order("name"),
    ]);

  const onHand = onHandRow?.on_hand ?? 0;
  const category = (product as { categories: { name: string } | null }).categories;

  // Resolve creator names for the audit log.
  const creatorIds = [
    ...new Set((movements ?? []).map((m) => m.created_by).filter(Boolean)),
  ] as string[];
  const { data: profiles } = creatorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", creatorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="grid gap-6">
      <div>
        <Link
          href="/inventory"
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to inventory
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.generic_name ? `${product.generic_name} · ` : ""}
              {category?.name ?? "Uncategorized"}
              {product.requires_prescription ? " · Rx" : ""}
              {product.is_active ? "" : " · Inactive"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  href={`/labels/${product.id}?branchId=${ctx.activeBranchId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <Printer className="size-4" />
              Print labels
            </Button>
            {canManage ? (
              <ReceiveStockDialog
                productId={product.id}
                productName={product.name}
                branchName={branchName}
                suppliers={suppliers ?? []}
                trigger={
                  <Button>
                    <PackagePlus className="size-4" />
                    Receive stock
                  </Button>
                }
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={`On hand (${branchName})`} value={String(onHand)} />
        <Stat label="Selling price" value={formatCentavos(product.default_price_centavos)} />
        <Stat label="Reorder point" value={String(product.reorder_point)} />
        <Stat label="Unit" value={product.unit} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch #</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit cost</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received</TableHead>
                {canManage ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches && batches.length > 0 ? (
                batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.batch_number ?? "—"}</TableCell>
                    <TableCell>
                      <ExpiryCell date={b.expiry_date} />
                    </TableCell>
                    <TableCell className="font-medium">{b.quantity}</TableCell>
                    <TableCell>{formatCentavos(b.cost_centavos)}</TableCell>
                    <TableCell>
                      {(b as { suppliers: { name: string } | null }).suppliers
                        ?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatManila(b.received_at, "MMM d, yyyy")}
                    </TableCell>
                    {canManage ? (
                      <TableCell className="text-right">
                        <AdjustBatchDialog
                          batchId={b.id}
                          productId={product.id}
                          currentQuantity={b.quantity}
                          trigger={
                            <Button variant="ghost" size="sm">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 7 : 6}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No stock on hand at this branch.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement history</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements && movements.length > 0 ? (
                movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">
                      {formatManila(m.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {MOVEMENT_LABELS[m.type as MovementType]}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={
                        m.quantity_delta < 0
                          ? "font-medium text-destructive"
                          : "font-medium text-emerald-600 dark:text-emerald-500"
                      }
                    >
                      {m.quantity_delta > 0 ? "+" : ""}
                      {m.quantity_delta}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.reason ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.created_by ? nameById.get(m.created_by) ?? "—" : "—"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No movements yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
