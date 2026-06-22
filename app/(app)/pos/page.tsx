import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { PosTerminal, type SellableProduct } from "@/components/pos/pos-terminal";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCentavos } from "@/lib/money";
import { formatManila, manilaBusinessDay, manilaDayRange } from "@/lib/date";
import { readLoyalty } from "@/lib/loyalty/settings";
import { canUseInventory } from "@/lib/billing/plans";

export default async function PosPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const tracksInventory = canUseInventory(ctx.organization.plan);
  const branchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";
  const { startUtc } = manilaDayRange(manilaBusinessDay());

  const [{ data: products }, { data: onHand }, { data: todays }, { data: recent }, { data: customers }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, generic_name, sku, barcode, unit, default_price_centavos")
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("v_product_on_hand")
        .select("product_id, on_hand")
        .eq("branch_id", ctx.activeBranchId),
      supabase
        .from("sales")
        .select("total_centavos")
        .eq("branch_id", ctx.activeBranchId)
        .eq("status", "completed")
        .gte("created_at", startUtc.toISOString()),
      supabase
        .from("sales")
        .select("id, receipt_number, total_centavos, status, created_at")
        .eq("branch_id", ctx.activeBranchId)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("customers")
        .select("id, name, phone, points_balance")
        .order("name"),
    ]);

  const onHandById = new Map(
    (onHand ?? []).map((r) => [r.product_id, r.on_hand ?? 0]),
  );
  // On inventory plans (Starter/Pro) we only sell what's in stock. On the Free
  // plan there are no batches, so every active product is sellable.
  const sellable: SellableProduct[] = (products ?? [])
    .map((p) => ({ ...p, on_hand: onHandById.get(p.id) ?? 0 }))
    .filter((p) => !tracksInventory || p.on_hand > 0);

  const todaysCount = todays?.length ?? 0;
  const todaysTotal = (todays ?? []).reduce((s, r) => s + r.total_centavos, 0);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Point of Sale"
        description={`Selling from ${branchName}. Today: ${todaysCount} sale(s), ${formatCentavos(todaysTotal)}.`}
      />

      <PosTerminal
        products={sellable}
        branchName={branchName}
        customers={customers ?? []}
        pesoPerPoint={readLoyalty(ctx.organization.settings).pesoPerPoint}
        tracksInventory={tracksInventory}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent sales</CardTitle>
        </CardHeader>
        <CardContent>
          {recent && recent.length > 0 ? (
            <div className="divide-y text-sm">
              {recent.map((s) => (
                <Link
                  key={s.id}
                  href={`/pos/receipt/${s.id}`}
                  className="flex items-center justify-between py-2 hover:underline"
                >
                  <span className="font-medium">#{s.receipt_number}</span>
                  <span className="text-muted-foreground">
                    {formatManila(s.created_at)}
                  </span>
                  <span className="flex items-center gap-2">
                    {s.status === "voided" ? (
                      <Badge variant="outline" className="text-destructive">
                        Voided
                      </Badge>
                    ) : null}
                    {formatCentavos(s.total_centavos)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No sales yet today.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
