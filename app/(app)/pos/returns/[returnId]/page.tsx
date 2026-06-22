import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date/index";
import { PrintButton } from "@/components/pos/print-button";
import { readBrand, PAPER_WIDTHS } from "@/lib/branding";

export default async function ReturnSummaryPage({
  params,
}: {
  params: Promise<{ returnId: string }>;
}) {
  const { returnId } = await params;
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: ret } = await supabase
    .from("sale_returns")
    .select("id, return_number, original_sale_id, reason, total_centavos, created_at, cashier_id")
    .eq("id", returnId)
    .maybeSingle();

  if (!ret) notFound();

  const { data: origSale } = await supabase
    .from("sales")
    .select("receipt_number")
    .eq("id", ret.original_sale_id)
    .maybeSingle();

  const { data: items } = await supabase
    .from("sale_return_items")
    .select("product_id, quantity, unit_price_centavos, line_total_centavos")
    .eq("return_id", returnId);

  const productIds = [...new Set((items ?? []).map((i) => i.product_id))];
  const { data: products } = productIds.length
    ? await supabase.from("products").select("id, name, unit").in("id", productIds)
    : { data: [] };
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  const { data: cashier } = ret.cashier_id
    ? await supabase.from("profiles").select("full_name").eq("id", ret.cashier_id).maybeSingle()
    : { data: null };

  const brand = readBrand(ctx.organization.settings);

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href={`/pos/receipt/${ret.original_sale_id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to original receipt
        </Link>
        <PrintButton />
      </div>

      <div className={`receipt-print mx-auto ${PAPER_WIDTHS[brand.receipt.paper]} rounded-lg border bg-white p-5 font-mono text-[13px] leading-relaxed text-black`}>
        <div className="text-center">
          <div className="text-base font-bold">{brand.name}</div>
          <div className="mt-1 text-xs font-bold tracking-widest">RETURN / CREDIT MEMO</div>
        </div>

        <div className="mt-3 border-t border-dashed pt-2 text-xs">
          <div className="flex justify-between">
            <span>Return No.</span>
            <span>#{ret.return_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Original OR</span>
            <span>#{origSale?.receipt_number ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{formatManila(ret.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span>Processed by</span>
            <span>{cashier?.full_name ?? "—"}</span>
          </div>
          {ret.reason ? (
            <div className="mt-1">
              <span className="text-muted-foreground">Reason: </span>{ret.reason}
            </div>
          ) : null}
        </div>

        <div className="mt-2 border-t border-dashed pt-2">
          {(items ?? []).map((it, i) => {
            const prod = productMap.get(it.product_id);
            return (
              <div key={i} className="mb-1">
                <div>{prod?.name ?? "Item"}</div>
                <div className="flex justify-between">
                  <span>
                    {it.quantity} {prod?.unit ?? ""} × {formatCentavos(it.unit_price_centavos)}
                  </span>
                  <span>{formatCentavos(it.line_total_centavos)}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 border-t border-dashed pt-2">
          <div className="flex justify-between font-bold">
            <span>TOTAL REFUND</span>
            <span>{formatCentavos(ret.total_centavos)}</span>
          </div>
        </div>

        <div className="mt-3 border-t border-dashed pt-2 text-center text-xs">
          This serves as your return / credit memo.
        </div>
      </div>
    </div>
  );
}
