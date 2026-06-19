import { notFound } from "next/navigation";
import { Coins, Receipt, Boxes, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardFilters } from "@/components/dashboard/filters";
import {
  RevenueChart,
  TopProductsChart,
  CategoryChart,
  PaymentChart,
} from "@/components/dashboard/charts";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { manilaBusinessDay, manilaDayRange, isoDaysAgo } from "@/lib/date";
import { formatInTimeZone } from "date-fns-tz";

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
  // pharmacists are scoped to their branch; owners/managers default to all.
  const branch = canViewAll ? (sp.branch ?? "all") : ctx.activeBranchId;

  const { startUtc } = manilaDayRange(from);
  const { endUtc } = manilaDayRange(to);

  let salesQuery = supabase
    .from("sales")
    .select("id, total_centavos, payment_method, created_at")
    .eq("status", "completed")
    .gte("created_at", startUtc.toISOString())
    .lt("created_at", endUtc.toISOString());
  if (branch !== "all") salesQuery = salesQuery.eq("branch_id", branch);
  const { data: sales } = await salesQuery;

  const saleIds = (sales ?? []).map((s) => s.id);
  const { data: items } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select("quantity, line_total_centavos, unit_cost_centavos, products(name, categories(name))")
        .in("sale_id", saleIds)
    : { data: [] as never[] };

  // --- aggregates ---
  const revenue = (sales ?? []).reduce((s, r) => s + r.total_centavos, 0);
  const transactions = sales?.length ?? 0;
  const itemsSold = (items ?? []).reduce((s, r) => s + r.quantity, 0);
  const profit = (items ?? []).reduce(
    (s, r) => s + (r.line_total_centavos - r.unit_cost_centavos * r.quantity),
    0,
  );

  const revByDay = new Map<string, number>();
  for (const s of sales ?? []) {
    const d = manilaBusinessDay(new Date(s.created_at));
    revByDay.set(d, (revByDay.get(d) ?? 0) + s.total_centavos);
  }
  const revenueData = enumerateDays(from, to).map((d) => ({
    day: formatInTimeZone(new Date(`${d}T00:00:00Z`), "UTC", "MMM d"),
    revenue: (revByDay.get(d) ?? 0) / 100,
  }));

  const prodAgg = new Map<string, number>();
  const catAgg = new Map<string, number>();
  for (const it of items ?? []) {
    const p = (it as { products: { name: string; categories: { name: string } | null } | null }).products;
    const pname = p?.name ?? "Unknown";
    prodAgg.set(pname, (prodAgg.get(pname) ?? 0) + it.line_total_centavos);
    const cname = p?.categories?.name ?? "Uncategorized";
    catAgg.set(cname, (catAgg.get(cname) ?? 0) + it.line_total_centavos);
  }
  const topProducts = [...prodAgg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, c]) => ({ name, total: c / 100 }));
  const categoryData = [...catAgg.entries()].map(([name, c]) => ({ name, value: c / 100 }));

  const payAgg = new Map<string, number>();
  for (const s of sales ?? []) {
    const k = s.payment_method.toUpperCase();
    payAgg.set(k, (payAgg.get(k) ?? 0) + s.total_centavos);
  }
  const paymentData = [...payAgg.entries()].map(([name, c]) => ({ name, value: c / 100 }));

  const cards = [
    { icon: Coins, label: "Revenue", value: formatCentavos(revenue) },
    { icon: TrendingUp, label: "Gross profit", value: formatCentavos(profit) },
    { icon: Receipt, label: "Transactions", value: String(transactions) },
    { icon: Boxes, label: "Items sold", value: String(itemsSold) },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Dashboard"
        description="Sales performance. Profit = selling price − snapshotted cost."
      />

      <DashboardFilters
        branches={ctx.branches}
        allowAll={canViewAll}
        from={from}
        to={to}
        branch={branch}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {transactions === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No sales in this range. Adjust the dates or make a sale in POS.
          </CardContent>
        </Card>
      ) : (
        <>
          <RevenueChart data={revenueData} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TopProductsChart data={topProducts} />
            <CategoryChart data={categoryData} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <PaymentChart data={paymentData} />
          </div>
        </>
      )}
    </div>
  );
}
