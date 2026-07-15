import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date/index";
import { formatCentavos } from "@/lib/money";
import { ReturnForm } from "@/components/pos/return-form";

export default async function ReturnPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const ctx = await requireAppContext();

  if (!can(ctx.role, "void_sale")) redirect("/pos");

  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select("id, receipt_number, created_at, total_centavos, status")
    .eq("id", saleId)
    .maybeSingle();

  if (!sale || sale.status !== "completed") notFound();

  // Aggregate sale_items into one row per product.
  const { data: rawItems } = await supabase
    .from("sale_items")
    .select("product_id, quantity, unit_price_centavos, products(name, unit)")
    .eq("sale_id", saleId);

  const byProduct = new Map<
    string,
    { name: string; unit: string; unitPrice: number; qty: number }
  >();
  for (const it of rawItems ?? []) {
    const prod = (it as { products: { name: string; unit: string } | null }).products;
    const cur = byProduct.get(it.product_id) ?? {
      name: prod?.name ?? "Item",
      unit: prod?.unit ?? "",
      unitPrice: it.unit_price_centavos,
      qty: 0,
    };
    cur.qty += it.quantity;
    byProduct.set(it.product_id, cur);
  }

  // Subtract already-returned quantities.
  const { data: priorReturns } = await supabase
    .from("sale_return_items")
    .select("product_id, quantity, sale_returns!inner(original_sale_id)")
    .eq("sale_returns.original_sale_id", saleId);

  const alreadyReturned = new Map<string, number>();
  for (const r of priorReturns ?? []) {
    alreadyReturned.set(r.product_id, (alreadyReturned.get(r.product_id) ?? 0) + r.quantity);
  }

  const lines = [...byProduct.entries()]
    .map(([productId, l]) => ({
      productId,
      name: l.name,
      unit: l.unit,
      unitPrice: l.unitPrice,
      maxQty: l.qty - (alreadyReturned.get(productId) ?? 0),
    }))
    .filter((l) => l.maxQty > 0);

  if (lines.length === 0) {
    return (
      <div className="p-6 space-y-3">
        <Link href={`/pos/receipt/${saleId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to receipt
        </Link>
        <p className="text-muted-foreground text-sm">All items on this sale have already been returned.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-6 max-w-2xl">
      <Link
        href={`/pos/receipt/${saleId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to receipt
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Process Return</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Receipt #{sale.receipt_number} · {formatManila(sale.created_at)} · {formatCentavos(sale.total_centavos)}
        </p>
      </div>

      <ReturnForm saleId={saleId} lines={lines} />
    </div>
  );
}
