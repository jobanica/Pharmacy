import { notFound } from "next/navigation";
import Link from "next/link";
import { Coins, Receipt, Boxes, TrendingUp, Warehouse, PiggyBank, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DashboardFilters } from "@/components/dashboard/filters";
import { SalesAnalytics, MarginDonut, type SalesPoint } from "@/components/dashboard/charts";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { manilaBusinessDay, manilaDayRange, isoDaysAgo, formatManila } from "@/lib/date";
import { expireTrials, getSubscription } from "@/lib/billing/service";
import { fetchAllRows } from "@/lib/supabase/paginate";

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
  // Lazy-expire trials so downgrade happens without a cron job.
  await expireTrials();

  const ctx = await requireAppContext();
  if (!can(ctx.role, "view_reports")) notFound();
  const supabase = await createClient();
  const subscription = await getSubscription();

  const sp = await searchParams;
  const today = manilaBusinessDay();
  const from = sp.from ?? isoDaysAgo(29);
  const to = sp.to ?? today;
  const canViewAll = ctx.role === "owner" || ctx.role === "manager";
  // Follow the header branch switcher by default; owners/managers can still
  // override to "all" or another branch via the dashboard filter.
  const branch = canViewAll ? (sp.branch ?? ctx.activeBranchId) : ctx.activeBranchId;

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
  const { data: items } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select("quantity, line_total_centavos, unit_cost_centavos, products(name)")
        .in("sale_id", saleIds)
    : { data: [] as never[] };

  // Current inventory value at cost = Σ(on-hand quantity × unit cost) across
  // batches. A live snapshot, not date-ranged; follows the branch filter.
  // Selling price is embedded so owners can also see potential profit.
  // Page through so "All branches" isn't undercounted (PostgREST caps at 1000
  // rows, and the combined branch batch count can exceed that).
  type BatchRow = {
    quantity: number;
    cost_centavos: number;
    products: { default_price_centavos: number } | null;
  };
  const batches = await fetchAllRows<BatchRow>((from, to) => {
    let q = supabase
      .from("batches")
      .select("quantity, cost_centavos, products(default_price_centavos)")
      .order("id") // unique tiebreaker so paging never repeats/skips rows
      .range(from, to);
    if (branch !== "all") q = q.eq("branch_id", branch);
    return q as unknown as PromiseLike<{ data: BatchRow[] | null }>;
  });
  const inventoryValue = batches.reduce(
    (s, b) => s + b.quantity * b.cost_centavos,
    0,
  );
  // Potential profit = Σ(on-hand quantity × (selling price − unit cost)) if all
  // current stock were sold at the product's price. Owner-only.
  const isOwner = ctx.role === "owner";
  const potentialProfit = isOwner
    ? batches.reduce((s, b) => {
        const price = b.products?.default_price_centavos ?? 0;
        return s + b.quantity * (price - b.cost_centavos);
      }, 0)
    : 0;

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
  for (const it of items ?? []) {
    const name = (it as { products: { name: string } | null }).products?.name ?? "Unknown";
    const cur = prodAgg.get(name) ?? { total: 0, qty: 0 };
    cur.total += it.line_total_centavos;
    cur.qty += it.quantity;
    prodAgg.set(name, cur);
  }
  const topProducts = [...prodAgg.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const recent = [...(sales ?? [])]
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 6);

  const cards: { icon: LucideIcon; label: string; value: string; gradient: string; sub?: string }[] = [
    { icon: Coins, label: "Total Revenue", value: formatCentavos(revenue), gradient: "from-blue-500 to-indigo-600" },
    { icon: TrendingUp, label: "Gross Profit", value: formatCentavos(profit), gradient: "from-teal-400 to-cyan-600", sub: `${marginPct.toFixed(0)}% margin` },
    { icon: Receipt, label: "Transactions", value: String(transactions), gradient: "from-violet-500 to-purple-600" },
    { icon: Boxes, label: "Items Sold", value: String(itemsSold), gradient: "from-pink-500 to-rose-500" },
    { icon: Warehouse, label: "Inventory Value", value: formatCentavos(inventoryValue), gradient: "from-amber-500 to-orange-600", sub: "at cost, on hand" },
    ...(isOwner
      ? [{ icon: PiggyBank, label: "Potential Profit", value: formatCentavos(potentialProfit), gradient: "from-emerald-500 to-green-600", sub: "if all stock sold" } as const]
      : []),
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

      {subscription?.status === "trialing" && subscription.trial_ends_at ? (
        <TrialBanner trialEndsAt={subscription.trial_ends_at} />
      ) : null}

      {/* Gradient stat cards */}
      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isOwner ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
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
