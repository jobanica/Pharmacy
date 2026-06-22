import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import { readTax } from "@/lib/tax/settings";
import { readBrand } from "@/lib/branding";
import { ReadingForm } from "@/components/pos/reading-form";

export const dynamic = "force-dynamic";

export default async function ReadingPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canClose = can(ctx.role, "manage_members");

  // Last Z-reading for this branch (to show period start).
  const { data: lastZ } = await supabase
    .from("register_readings")
    .select("closed_at, z_counter")
    .eq("branch_id", ctx.activeBranchId)
    .eq("type", "z")
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const periodFrom = lastZ?.closed_at ?? null;

  // Current-period sales snapshot (X-reading preview).
  const salesQ = supabase
    .from("sales")
    .select("id, total_centavos, discount_centavos, subtotal_centavos, payment_method, amount_tendered_centavos")
    .eq("branch_id", ctx.activeBranchId)
    .eq("status", "completed");

  const { data: sales } = periodFrom
    ? await salesQ.gte("created_at", periodFrom)
    : await salesQ;

  const tax = readTax(ctx.organization.settings);
  const brand = readBrand(ctx.organization.settings);

  const gross = (sales ?? []).reduce((s, x) => s + x.subtotal_centavos, 0);
  const discounts = (sales ?? []).reduce((s, x) => s + x.discount_centavos, 0);
  const net = (sales ?? []).reduce((s, x) => s + x.total_centavos, 0);
  const cash = (sales ?? [])
    .filter((x) => x.payment_method === "cash")
    .reduce((s, x) => s + x.amount_tendered_centavos, 0);

  const divisor = 1 + tax.vatRatePct / 100;
  const vatable = Math.round(net / divisor);
  const vatAmt = net - vatable;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Cash Register Reading"
        description="X-reading: current shift snapshot. Z-reading: end-of-day close (non-resettable)."
      />

      <Link
        href="/pos"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to POS
      </Link>

      {/* Live snapshot (X-reading preview) */}
      <div className="mx-auto w-full max-w-sm rounded-lg border bg-white p-5 font-mono text-[13px] leading-relaxed text-black">
        <div className="text-center">
          <div className="text-base font-bold">{brand.name}</div>
          {tax.tin ? <div className="text-xs">TIN: {tax.tin}</div> : null}
          <div className="mt-1 text-xs font-semibold">*** X-READING (CURRENT SHIFT) ***</div>
        </div>

        <div className="mt-3 border-t border-dashed pt-2 text-xs">
          <Row label="Period from" value={periodFrom ? formatManila(periodFrom) : "Beginning of records"} />
          <Row label="Sales count" value={String((sales ?? []).length)} />
        </div>

        <div className="mt-2 border-t border-dashed pt-2 text-xs">
          <Row label="Gross sales" value={formatCentavos(gross)} />
          <Row label="Discounts" value={`-${formatCentavos(discounts)}`} />
          <Row label="Net sales" value={formatCentavos(net)} bold />
        </div>

        <div className="mt-2 border-t border-dashed pt-2 text-xs">
          <Row label={`VATable sales`} value={formatCentavos(vatable)} />
          <Row label={`VAT (${tax.vatRatePct}%)`} value={formatCentavos(vatAmt)} />
          <Row label="VAT-exempt" value={formatCentavos(0)} />
          <Row label="Zero-rated" value={formatCentavos(0)} />
        </div>

        <div className="mt-2 border-t border-dashed pt-2 text-xs">
          <Row label="Cash" value={formatCentavos(cash)} />
        </div>

        {lastZ ? (
          <div className="mt-2 border-t border-dashed pt-2 text-center text-xs text-gray-500">
            Last Z: #{lastZ.z_counter} · {formatManila(lastZ.closed_at)}
          </div>
        ) : null}
      </div>

      {canClose ? (
        <ReadingForm lastZAt={lastZ?.closed_at ?? null} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Only owners, managers, and pharmacists can close a reading.
        </p>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
