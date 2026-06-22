import { notFound } from "next/navigation";
import Link from "next/link";
import { Coins, Receipt, Boxes, TrendingUp, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DashboardFilters } from "@/components/dashboard/filters";
import {
  SalesAnalytics,
  MarginDonut,
  CategoryChart,
  HourlyChart,
  PaymentMethodChart,
  type SalesPoint,
  type CategoryPoint,
  type HourPoint,
  type PaymentPoint,
} from "@/components/dashboard/charts";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { manilaBusinessDay, manilaDayRange, isoDaysAgo, formatManila } from "@/lib/date";

function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cur <= end && days.length < 366) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "view_reports")) notFound();
  const supabase = await createClient();

  const sp = await searchParams;
  const today = manilaBusinessDay();
  const from = sp.from ?? isoDaysAgo(29);
  const to = sp.to ?? today;
  const canViewAll = ctx.role === "owner" || ctx.role === "manager";
  const branch = canViewAll ? (sp.branch ?? "all") : ctx.activeBranchId;

  const { startUtc } = manilaDayRange(from);
  const { endUtc } = manilaDayRange(to);

  let salesQuery = supabase
    .from("sales")
    .select("id, total_centavos, created_at, receipt_number")
    .eq("status", "completed")
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", endUtc.toISOString());
  if (branch !== "all") salesQuery = salesQuery.eq("branch_id", branch);
  const { data: sales } = await salesQuery;

  const saleIds = (sales ?? []).map((s) => s.id);

  // Expiry risk: batches expiring within 90 days at the active branch.
  const ninetyDaysOut = new Date();
  ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

  const [{ data: items }, { data: allPayments }, { data: expiryBatches }] = await Promise.all([
    saleIds.length
      ? supabase
          .from("sale_items")
          .select("quantity, line_total_centavos, unit_cost_centavos, products(name, categories(name))")
          .in("sale_id", saleIds)
      : Promise.resolve({ data: [] as never[] }),
    saleIds.length
      ? supabase
          .from("sale_payments")
          .select("method, amount_centavos")
          .in("sale_id", saleIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("batches")
      .select("id, expiry_date, quantity, products(name)")
      .eq("branch_id", ctx.activeBranchId)
      .gt("quantity", 0)
      .not("expiry_date", "is", null)
      .lte("expiry_date", ninetyDaysOut.toISOString().slice(0, 10))
      .order("expiry_date", { ascending: true }),
  ]);

  const revenue = (sales ?? []).reduce((s, r) => s + r.total_centavos, 0);
  const transactions = sales?.length ?? 0;
  const itemsSold = (items ?? []).reduce((s, r) => s + r.quantity, 0);
  const profit = (items ?? []).reduce(
    (s, r) => s + (r.line_total_centavos - r.unit_cost_centavos * r.quantity),
    0,
  );
  const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

  const revByDay = new Map<string, number>();
  const cntByDay = new Map<string, number>();
  for (const s of sales ?? []) {
    const d = manilaBusinessDay(new Date(s.created_at));
    revByDay.set(d, (revByDay.get(d) ?? 0) + s.total_centavos);
    cntByDay.set(d, (cntByDay.get(d) ?? 0) + 1);
  }
  const series: SalesPoint[] = enumerateDays(from, to).map((iso) => ({
    iso,
    revenue: (revByDay.get(iso) ?? 0) / 100,
    count: cntByDay.get(iso) ?? 0,
  }));

  const prodAgg = new Map<string, { total: number; qty: number }>();
  const catAgg = new Map<string, number>();
  for (const it of items ?? []) {
    const row = it as { products: { name: string; categories: { name: string } | null } | null };
    const name = row.products?.name ?? "Unknown";
    const cat = row.products?.categories?.name ?? "Uncategorized";
    const cur = prodAgg.get(name) ?? { total: 0, qty: 0 };
    cur.total += it.line_total_centavos;
    cur.qty += it.quantity;
    prodAgg.set(name, cur);
    catAgg.set(cat, (catAgg.get(cat) ?? 0) + it.line_total_centavos);
  }
  const topProducts = [...prodAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const categoryData: CategoryPoint[] = [...catAgg.entries()]
    .map(([name, revenue]) => ({ name, revenue: revenue / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  // Hourly distribution of sales in local time (Manila UTC+8).
  const hourlyAgg = new Map<number, { count: number; revenue: number }>();
  for (const s of sales ?? []) {
    const hour = (new Date(s.created_at).getUTCHours() + 8) % 24;
    const cur = hourlyAgg.get(hour) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += s.total_centavos;
    hourlyAgg.set(hour, cur);
  }
  const hourlyData: HourPoint[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: hourlyAgg.get(h)?.count ?? 0,
    revenue: hourlyAgg.get(h)?.revenue ?? 0,
  }));

  // Payment method totals.
  const methodAgg = new Map<string, number>();
  for (const p of allPayments ?? []) {
    methodAgg.set(p.method, (methodAgg.get(p.method) ?? 0) + p.amount_centavos);
  }
  const paymentData: PaymentPoint[] = [...methodAgg.entries()]
    .map(([method, total]) => ({ method, total }))
    .sort((a, b) => b.total - a.total);

  // Expiry risk buckets.
  const today30 = new Date(); today30.setDate(today30.getDate() + 30);
  const today60 = new Date(); today60.setDate(today60.getDate() + 60);
  const expiring30 = (expiryBatches ?? []).filter((b) => new Date(b.expiry_date!) <= today30);
  const expiring60 = (expiryBatches ?? []).filter(
    (b) => new Date(b.expiry_date!) > today30 && new Date(b.expiry_date!) <= today60,
  );
  const expiring90 = (expiryBatches ?? []).filter(
    (b) => new Date(b.expiry_date!) > today60,
  );

  const recent = [...(sales ?? [])]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 6);

  const cards: { icon: LucideIcon; label: string; value: string; gradient: string; sub?: string }[] = [
    { icon: Coins, label: "Total Revenue", value: formatCentavos(revenue), gradient: "from-blue-500 to-indigo-600" },
    { icon: TrendingUp, label: "Gross Profit", value: formatCentavos(profit), gradient: "from-teal-400 to-cyan-600", sub: `${marginPct.toFixed(0)}% margin` },
    { icon: Receipt, label: "Transactions", value: String(transactions), gradient: "from-violet-500 to-purple-600" },
    { icon: Boxes, label: "Items Sold", value: String(itemsSold), gradient: "from-pink-500 to-rose-500" },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Profit = selling price − snapshotted cost.
          </p>
        </div>
        <DashboardFilters branches={ctx.branches} allowAll={canViewAll} from={from} to={to} branch={branch} />
      </div>

      {/* Gradient stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient} p-5 text-white shadow-lg`}
            >
              <div className="absolute -right-5 -top-5 size-24 rounded-full bg-white/15 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">{c.label}</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
                  <Icon className="size-5" />
                </span>
              </div>
              <div className="mt-3 text-3xl font-bold">{c.value}</div>
              {c.sub ? <div className="mt-1 text-xs text-white/80">{c.sub}</div> : null}
            </div>
          );
        })}
      </div>

      {transactions === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] py-16 text-center text-sm text-muted-foreground backdrop-blur-xl">
          No sales in this range. Adjust the dates or make a sale in POS.
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            <MarginDonut marginPct={marginPct} revenue={revenue / 100} profit={profit / 100} />
            <SalesAnalytics data={series} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <CategoryChart data={categoryData} />
            <HourlyChart data={hourlyData} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PaymentMethodChart data={paymentData} />

            {/* Expiry risk */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <h3 className="mb-3 font-semibold">Expiry risk (active branch)</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "≤ 30 days", items: expiring30, color: "text-destructive" },
                  { label: "31–60 days", items: expiring60, color: "text-amber-400" },
                  { label: "61–90 days", items: expiring90, color: "text-yellow-300" },
                ].map(({ label, items, color }) => (
                  <div key={label} className="rounded-xl bg-white/5 p-3 text-center">
                    <div className={`text-2xl font-bold ${color}`}>{items.length}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              {expiring30.length > 0 ? (
                <div className="mt-3 space-y-1">
                  {expiring30.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-xs">
                      <span className="truncate text-muted-foreground">
                        {(b as { products: { name: string } | null }).products?.name ?? "—"}
                      </span>
                      <span className="shrink-0 text-destructive">{b.expiry_date}</span>
                    </div>
                  ))}
                  {expiring30.length > 5 ? (
                    <p className="text-xs text-muted-foreground">+{expiring30.length - 5} more</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No batches expiring within 30 days.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top products */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <h3 className="mb-3 font-semibold">Top products</h3>
              <div className="space-y-1">
                {topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.qty} sold</div>
                    </div>
                    <span className="text-sm font-semibold">{formatCentavos(p.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent sales */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Recent sales</h3>
                <Link href="/pos" className="text-xs text-fuchsia-300 hover:underline">
                  Go to POS →
                </Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Receipt</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.id} className="border-t border-white/5">
                      <td className="py-2">
                        <Link href={`/pos/receipt/${s.id}`} className="font-medium hover:underline">
                          #{s.receipt_number}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">{formatManila(s.created_at, "MMM d, h:mm a")}</td>
                      <td className="py-2 text-right">
                        <Badge variant="secondary" className="bg-white/10">
                          {formatCentavos(s.total_centavos)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
