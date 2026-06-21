import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PrintButton } from "@/components/pos/print-button";
import { VoidSaleButton } from "@/components/pos/void-sale-button";
import { AutoPrint } from "@/components/pos/auto-print";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import { readBrand, PAPER_WIDTHS } from "@/lib/branding";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const { saleId } = await params;
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: sale } = await supabase
    .from("sales")
    .select(
      "id, branch_id, receipt_number, cashier_id, subtotal_centavos, discount_centavos, total_centavos, payment_method, amount_tendered_centavos, change_centavos, status, created_at, customer_id, points_earned, points_redeemed",
    )
    .eq("id", saleId)
    .maybeSingle();

  if (!sale) notFound();

  const { data: customer } = sale.customer_id
    ? await supabase
        .from("customers")
        .select("name, points_balance")
        .eq("id", sale.customer_id)
        .maybeSingle()
    : { data: null };

  const [{ data: items }, { data: branch }, { data: cashier }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("product_id, quantity, unit_price_centavos, line_total_centavos, products(name, unit)")
      .eq("sale_id", saleId),
    supabase.from("branches").select("name").eq("id", sale.branch_id).maybeSingle(),
    sale.cashier_id
      ? supabase.from("profiles").select("full_name").eq("id", sale.cashier_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // FEFO may split a line across batches — aggregate back to one row per product.
  const byProduct = new Map<
    string,
    { name: string; unit: string; unitPrice: number; qty: number; total: number }
  >();
  for (const it of items ?? []) {
    const prod = (it as { products: { name: string; unit: string } | null }).products;
    const key = it.product_id;
    const cur =
      byProduct.get(key) ??
      { name: prod?.name ?? "Item", unit: prod?.unit ?? "", unitPrice: it.unit_price_centavos, qty: 0, total: 0 };
    cur.qty += it.quantity;
    cur.total += it.line_total_centavos;
    byProduct.set(key, cur);
  }
  const lines = [...byProduct.values()];
  const voided = sale.status === "voided";
  const canVoid = can(ctx.role, "void_sale") && !voided;
  const brand = readBrand(ctx.organization.settings);

  return (
    <div className="mx-auto max-w-md">
      <AutoPrint enabled={brand.receipt.autoPrint} />
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          href="/pos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to POS
        </Link>
        <div className="flex gap-2">
          <PrintButton />
          {canVoid ? <VoidSaleButton saleId={sale.id} /> : null}
        </div>
      </div>

      <div className={`receipt-print mx-auto ${PAPER_WIDTHS[brand.receipt.paper]} rounded-lg border bg-white p-5 font-mono text-[13px] leading-relaxed text-black`}>
        <div className="text-center">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="mx-auto mb-2 h-10 object-contain" />
          ) : null}
          <div className="text-base font-bold">{brand.name}</div>
          <div>{branch?.name ?? ""}</div>
          {brand.receipt.header ? (
            <div className="mt-1 whitespace-pre-line text-xs">{brand.receipt.header}</div>
          ) : null}
          <div className="mt-1 text-xs">OFFICIAL RECEIPT</div>
        </div>

        {voided ? (
          <div className="my-2 border-y border-dashed py-1 text-center font-bold tracking-widest">
            *** VOIDED ***
          </div>
        ) : null}

        <div className="mt-3 border-t border-dashed pt-2 text-xs">
          <div className="flex justify-between">
            <span>Receipt</span>
            <span>#{sale.receipt_number}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{formatManila(sale.created_at)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier</span>
            <span>{cashier?.full_name ?? "—"}</span>
          </div>
        </div>

        <div className="mt-2 border-t border-dashed pt-2">
          {lines.map((l, i) => (
            <div key={i} className="mb-1">
              <div>{l.name}</div>
              <div className="flex justify-between">
                <span>
                  {l.qty} {l.unit} × {formatCentavos(l.unitPrice)}
                </span>
                <span>{formatCentavos(l.total)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 border-t border-dashed pt-2">
          <Row label="Subtotal" value={formatCentavos(sale.subtotal_centavos)} />
          {sale.discount_centavos > 0 ? (
            <Row label="Discount" value={`-${formatCentavos(sale.discount_centavos)}`} />
          ) : null}
          {sale.points_redeemed > 0 ? (
            <Row label={`Points (${sale.points_redeemed})`} value={`-${formatCentavos(sale.points_redeemed * 100)}`} />
          ) : null}
          <Row label="TOTAL" value={formatCentavos(sale.total_centavos)} bold />
          <Row label="Cash" value={formatCentavos(sale.amount_tendered_centavos)} />
          <Row label="Change" value={formatCentavos(sale.change_centavos)} />
          <Row label="Payment" value={sale.payment_method.toUpperCase()} />
        </div>

        {customer ? (
          <div className="mt-2 border-t border-dashed pt-2 text-xs">
            <div className="text-center font-semibold">★ Loyalty</div>
            <Row label="Member" value={customer.name} />
            {sale.points_redeemed > 0 ? <Row label="Redeemed" value={`-${sale.points_redeemed} pts`} /> : null}
            <Row label="Earned" value={`+${sale.points_earned} pts`} />
            <Row label="Balance" value={`${customer.points_balance} pts`} />
          </div>
        ) : null}

        <div className="mt-3 whitespace-pre-line border-t border-dashed pt-2 text-center text-xs">
          {brand.receipt.footer ?? "Thank you for shopping!"}
          <div className="mt-1">This serves as your official receipt.</div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
