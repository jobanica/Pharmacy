import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date/index";
import { Badge } from "@/components/ui/badge";
import { StocktakeSheet } from "@/components/inventory/stocktake-sheet";

export default async function StocktakeDetailPage({
  params,
}: {
  params: Promise<{ stocktakeId: string }>;
}) {
  const { stocktakeId } = await params;
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: st } = await supabase
    .from("stocktakes")
    .select("id, status, notes, created_at, approved_at, branch_id")
    .eq("id", stocktakeId)
    .maybeSingle();

  if (!st) notFound();

  const { data: rawItems } = await supabase
    .from("stocktake_items")
    .select("id, product_id, system_qty, counted_qty")
    .eq("stocktake_id", stocktakeId)
    .order("product_id");

  const productIds = (rawItems ?? []).map((i) => i.product_id);
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, name, unit").in("id", productIds)
    : { data: [] };
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  const items = (rawItems ?? []).map((i) => ({
    id: i.id,
    productId: i.product_id,
    name: productMap.get(i.product_id)?.name ?? i.product_id,
    unit: productMap.get(i.product_id)?.unit ?? "",
    systemQty: i.system_qty,
    countedQty: i.counted_qty,
  })).sort((a, b) => a.name.localeCompare(b.name));

  const approved = st.status === "approved";
  const canApprove = can(ctx.role, "void_sale"); // owners + managers

  return (
    <div className="space-y-5 p-6 max-w-4xl">
      <Link
        href="/inventory/stocktake"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to stocktakes
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Stocktake</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Started {formatManila(st.created_at)}
            {st.approved_at ? ` · Approved ${formatManila(st.approved_at)}` : ""}
          </p>
          {st.notes ? <p className="text-sm text-muted-foreground mt-1">{st.notes}</p> : null}
        </div>
        <Badge variant={approved ? "secondary" : "default"}>
          {approved ? "Approved" : "Draft"}
        </Badge>
      </div>

      <StocktakeSheet
        stocktakeId={stocktakeId}
        items={items}
        canApprove={canApprove}
        approved={approved}
      />
    </div>
  );
}
