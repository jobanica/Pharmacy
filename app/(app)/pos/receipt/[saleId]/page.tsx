import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PrintButton } from "@/components/pos/print-button";
import { BluetoothPrintButton } from "@/components/pos/bluetooth-print-button";
import { VoidSaleButton } from "@/components/pos/void-sale-button";
import { AutoPrint } from "@/components/pos/auto-print";
import type { ReceiptData } from "@/lib/escpos/receipt";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import { readBrand, PAPER_WIDTHS } from "@/lib/branding";
import { readTax, vatBreakdown } from "@/lib/tax/settings";

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
      "id, branch_id, receipt_number, cashier_id, subtotal_centavos, discount_centavos, total_centavos, payment_method, amount_tendered_centavos, change_centavos, status, created_at, customer_id, points_earned, points_redeemed, discount_type, beneficiary_id_no, beneficiary_name, vat_exempt_centavos, prescription_id",
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

  const { data: prescription } = sale.prescription_id
    ? await supabase
        .from("prescriptions")
        .select("patient_name, patient_dob, doctor_name, doctor_prc_no, date_issued, rx_number")
        .eq("id", sale.prescription_id)
        .maybeSingle()
    : { data: null };

  const [{ data: items }, { data: branch }, { data: cashier }, { data: payments }] = await Promise.all([
    supabase
      .from("sale_items")
      .select("id, product_id, item_name, quantity, unit_price_centavos, line_total_centavos, products(name, unit)")
      .eq("sale_id", saleId),
    supabase.from("branches").select("name").eq("id", sale.branch_id).maybeSingle(),
    sale.cashier_id
      ? supabase.from("profiles").select("full_name").eq("id", sale.cashier_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("sale_payments").select("method, amount_centavos").eq("sale_id", saleId).order("created_at"),
  ]);

  // FEFO may split a line across batches — aggregate back to one row per product.
  const byProduct = new Map<
    string,
    { name: string; unit: string; unitPrice: number; qty: number; total: number }
  >();
  for (const it of items ?? []) {
    const prod = (it as { products: { name: string; unit: string } | null }).products;
    const manual = it.product_id == null;
    // Catalog lines aggregate by product (FEFO can split across batches);
    // manual lines are keyed by their own id so each stays a distinct row.
    const key = manual ? `m:${it.id}` : `p:${it.product_id}`;
    const cur =
      byProduct.get(key) ??
      {
        name: manual ? (it.item_name ?? "Item") : (prod?.name ?? "Item"),
        unit: manual ? "" : (prod?.unit ?? ""),
        unitPrice: it.unit_price_centavos,
        qty: 0,
        total: 0,
      };
    cur.qty += it.quantity;
    cur.total += it.line_total_centavos;
    byProduct.set(key, cur);
  }
  const lines = [...byProduct.values()];
  const voided = sale.status === "voided";
  const canVoid = can(ctx.role, "void_sale") && !voided;
  const brand = readBrand(ctx.organization.settings);
  const tax = readTax(ctx.organization.settings);
  const isVatExempt = (sale.vat_exempt_centavos ?? 0) > 0;
  const vatableSales = isVatExempt ? 0 : sale.total_centavos;
  const vat = vatBreakdown(vatableSales, tax.vatRatePct);
  const vatExemptSales = isVatExempt ? sale.total_centavos : 0;

  const discountLabel =
    sale.discount_type === "sc" ? "SC Discount (20%)" :
    sale.discount_type === "pwd" ? "PWD Discount (20%)" :
    sale.discount_centavos > 0 ? "Discount" : null;
  const beneficiary =
    (sale.discount_type === "sc" || sale.discount_type === "pwd") && sale.beneficiary_name
      ? `${sale.discount_type === "sc" ? "SC" : "PWD"}: ${sale.beneficiary_name}${
          sale.beneficiary_id_no ? ` - ${sale.beneficiary_id_no}` : ""
        }`
      : null;
  const receiptPayments =
    payments && payments.length > 0
      ? payments
      : [{ method: sale.payment_method, amount_centavos: sale.amount_tendered_centavos }];

  const receiptData: ReceiptData = {
    storeName: brand.name,
    branchName: branch?.name ?? "",
    header: brand.receipt.header,
    footer: brand.receipt.footer,
    tin: tax.tin,
    address: tax.businessAddress,
    receiptNumber: String(sale.receipt_number),
    dateText: formatManila(sale.created_at),
    cashier: cashier?.full_name ?? "—",
    voided,
    lines: lines.map((l) => ({
      name: l.name,
      qty: l.qty,
      unit: l.unit,
      unitPrice: l.unitPrice,
      total: l.total,
    })),
    subtotal: sale.subtotal_centavos,
    discount: sale.discount_centavos,
    discountLabel,
    beneficiary,
    pointsRedeemed: sale.points_redeemed,
    total: sale.total_centavos,
    payments: receiptPayments.map((p) => ({ method: p.method, amount: p.amount_centavos })),
    change: sale.change_centavos,
    customer: customer
      ? { name: customer.name, pointsEarned: sale.points_earned, pointsBalance: customer.points_balance }
      : null,
    vatableSales: vat.vatableCentavos,
    vatAmount: vat.vatCentavos,
    vatRatePct: tax.vatRatePct,
    vatExemptSales,
    accreditationNo: tax.accreditationNo,
    permitNo: tax.permitNo,
    atpNo: tax.atpNo,
    paper: brand.receipt.paper,
  };

  return (
    <div className="mx-auto max-w-md">
      <AutoPrint
        enabled={brand.receipt.autoPrint}
        printerType={brand.receipt.printerType}
        receipt={receiptData}
      />
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
          <BluetoothPrintButton receipt={receiptData} />
          {canVoid ? <VoidSaleButton saleId={sale.id} /> : null}
          {canVoid && !voided ? (
            <Link
              href={`/pos/receipt/${sale.id}/return`}
              className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Return
            </Link>
          ) : null}
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
          {tax.tin ? <div className="text-xs">TIN: {tax.tin}</div> : null}
          {tax.businessAddress ? (
            <div className="whitespace-pre-line text-xs">{tax.businessAddress}</div>
          ) : null}
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
            <Row
              label={
                sale.discount_type === "sc" ? "SC Discount (20%)" :
                sale.discount_type === "pwd" ? "PWD Discount (20%)" :
                "Discount"
              }
              value={`-${formatCentavos(sale.discount_centavos)}`}
            />
          ) : null}
          {(sale.discount_type === "sc" || sale.discount_type === "pwd") && sale.beneficiary_name ? (
            <div className="text-xs text-muted-foreground">
              {sale.discount_type === "sc" ? "SC" : "PWD"}: {sale.beneficiary_name}
              {sale.beneficiary_id_no ? ` — ${sale.beneficiary_id_no}` : ""}
            </div>
          ) : null}
          {sale.points_redeemed > 0 ? (
            <Row label={`Points (${sale.points_redeemed})`} value={`-${formatCentavos(sale.points_redeemed * 100)}`} />
          ) : null}
          <Row label="TOTAL" value={formatCentavos(sale.total_centavos)} bold />
          {(payments && payments.length > 0 ? payments : [{ method: sale.payment_method, amount_centavos: sale.amount_tendered_centavos }]).map((p, i) => (
            <Row key={i} label={p.method.toUpperCase()} value={formatCentavos(p.amount_centavos)} />
          ))}
          <Row label="Change" value={formatCentavos(sale.change_centavos)} />
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

        <div className="mt-2 border-t border-dashed pt-2 text-xs">
          <Row label="VATable Sales" value={formatCentavos(vat.vatableCentavos)} />
          <Row label={`VAT Amount (${tax.vatRatePct}%)`} value={formatCentavos(vat.vatCentavos)} />
          <Row label="VAT-Exempt Sales" value={formatCentavos(vatExemptSales)} />
          <Row label="Zero-Rated Sales" value={formatCentavos(0)} />
        </div>

        <div className="mt-2 border-t border-dashed pt-2 text-xs text-center">
          {tax.accreditationNo ? <div>Accreditation No.: {tax.accreditationNo}</div> : null}
          {tax.permitNo ? <div>Permit No.: {tax.permitNo}</div> : null}
          {tax.atpNo ? <div>ATP No.: {tax.atpNo}</div> : null}
        </div>

        {prescription ? (
          <div className="mt-2 border-t border-dashed pt-2 text-xs">
            <div className="text-center font-semibold">Prescription</div>
            <Row label="Patient" value={prescription.patient_name} />
            <Row label="Doctor" value={`Dr. ${prescription.doctor_name}`} />
            {prescription.doctor_prc_no ? <Row label="PRC No." value={prescription.doctor_prc_no} /> : null}
            <Row label="Date issued" value={prescription.date_issued} />
            {prescription.rx_number ? <Row label="Rx No." value={prescription.rx_number} /> : null}
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
