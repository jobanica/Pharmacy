import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date/index";
import { OpenShiftForm, CloseShiftForm } from "@/components/pos/shift-forms";

export default async function ShiftPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: openShift } = await supabase
    .from("cashier_shifts")
    .select("id, opened_at, opening_cash_centavos, cashier_id")
    .eq("branch_id", ctx.activeBranchId)
    .eq("status", "open")
    .maybeSingle();

  // Live sales summary for the open shift.
  const { data: liveSales } = openShift
    ? await supabase
        .from("sales")
        .select("total_centavos, discount_centavos")
        .eq("shift_id", openShift.id)
        .eq("status", "completed")
    : { data: null };

  const liveSalesCount = liveSales?.length ?? 0;
  const liveGross = liveSales?.reduce((s, r) => s + r.total_centavos + r.discount_centavos, 0) ?? 0;
  const liveDiscount = liveSales?.reduce((s, r) => s + r.discount_centavos, 0) ?? 0;
  const liveNet = liveSales?.reduce((s, r) => s + r.total_centavos, 0) ?? 0;

  // Cash collected so far in the open shift.
  const { data: cashPayments } = openShift
    ? await supabase
        .from("sale_payments")
        .select("amount_centavos, sales!inner(shift_id, status)")
        .eq("method", "cash")
        .eq("sales.shift_id", openShift.id)
        .eq("sales.status", "completed")
    : { data: null };

  const liveCash = cashPayments?.reduce((s, p) => s + p.amount_centavos, 0) ?? 0;
  const expectedCash = openShift ? openShift.opening_cash_centavos + liveCash : 0;

  // Recent closed shifts.
  const { data: history } = await supabase
    .from("cashier_shifts")
    .select("id, opened_at, closed_at, sales_count, net_centavos, opening_cash_centavos, closing_cash_centavos, over_short_centavos, cashier_id")
    .eq("branch_id", ctx.activeBranchId)
    .eq("status", "closed")
    .order("opened_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Cashier Shift</h1>

      {openShift ? (
        <div className="rounded-lg border p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-emerald-600">Shift open</div>
              <div className="text-sm text-muted-foreground">
                Opened {formatManila(openShift.opened_at)} · Opening cash {formatCentavos(openShift.opening_cash_centavos)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-4 text-sm sm:grid-cols-4">
            <Stat label="Sales" value={String(liveSalesCount)} />
            <Stat label="Gross" value={formatCentavos(liveGross)} />
            <Stat label="Discounts" value={formatCentavos(liveDiscount)} />
            <Stat label="Net" value={formatCentavos(liveNet)} />
            <Stat label="Cash collected" value={formatCentavos(liveCash)} />
            <Stat label="Expected cash" value={formatCentavos(expectedCash)} />
          </div>

          <div>
            <h2 className="mb-3 text-sm font-medium">Close shift</h2>
            <CloseShiftForm shiftId={openShift.id} />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border p-5 space-y-3">
          <div className="text-muted-foreground text-sm">No open shift for this branch.</div>
          <OpenShiftForm />
        </div>
      )}

      {history && history.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Recent shifts</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Opened</th>
                  <th className="px-3 py-2 text-left">Closed</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2 text-right">Opening cash</th>
                  <th className="px-3 py-2 text-right">Closing cash</th>
                  <th className="px-3 py-2 text-right">Over/Short</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => {
                  const os = s.over_short_centavos ?? 0;
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2">{formatManila(s.opened_at)}</td>
                      <td className="px-3 py-2">{s.closed_at ? formatManila(s.closed_at) : "—"}</td>
                      <td className="px-3 py-2 text-right">{s.sales_count ?? 0}</td>
                      <td className="px-3 py-2 text-right">{formatCentavos(s.net_centavos ?? 0)}</td>
                      <td className="px-3 py-2 text-right">{formatCentavos(s.opening_cash_centavos)}</td>
                      <td className="px-3 py-2 text-right">{formatCentavos(s.closing_cash_centavos ?? 0)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${os < 0 ? "text-destructive" : os > 0 ? "text-emerald-600" : ""}`}>
                        {os === 0 ? "—" : `${os > 0 ? "+" : ""}${formatCentavos(Math.abs(os))}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
