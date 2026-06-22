"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(n);

export type SalesPoint = { iso: string; revenue: number; count: number };
type Period = "daily" | "weekly" | "monthly";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function label(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function bucket(data: SalesPoint[], period: Period) {
  if (period === "daily") {
    return data.slice(-14).map((d) => ({ label: label(d.iso), revenue: d.revenue, count: d.count }));
  }
  const groups = new Map<string, { label: string; revenue: number; count: number; order: number }>();
  data.forEach((d, i) => {
    let key: string, lab: string;
    if (period === "weekly") {
      const wk = Math.floor(i / 7);
      key = `w${wk}`;
      lab = label(data[Math.min(wk * 7, data.length - 1)].iso);
    } else {
      const dt = new Date(`${d.iso}T00:00:00Z`);
      key = `${dt.getUTCFullYear()}-${dt.getUTCMonth()}`;
      lab = MONTHS[dt.getUTCMonth()];
    }
    const g = groups.get(key) ?? { label: lab, revenue: 0, count: 0, order: i };
    g.revenue += d.revenue;
    g.count += d.count;
    groups.set(key, g);
  });
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

export function SalesAnalytics({ data }: { data: SalesPoint[] }) {
  const [period, setPeriod] = React.useState<Period>("daily");
  const rows = React.useMemo(() => bucket(data, period), [data, period]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Sales analytics</h3>
        <div className="flex rounded-lg bg-white/5 p-0.5 text-xs">
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1 capitalize transition ${
                period === p ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 5, right: 6, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="100%" stopColor="#0E7490" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.5)" />
            <YAxis fontSize={11} tickLine={false} axisLine={false} width={48} stroke="rgba(255,255,255,0.5)" />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{ background: "#211a3e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, color: "#fff" }}
              formatter={(v, name) => (name === "revenue" ? peso(Number(v)) : `${v} sales`)}
            />
            <Bar dataKey="revenue" fill="url(#barGrad)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Line type="monotone" dataKey="count" stroke="#E879F9" strokeWidth={2.5} dot={{ r: 3, fill: "#E879F9" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  background: "#211a3e",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  color: "#fff",
};

const CAT_COLORS = ["#7C3AED", "#2DD4BF", "#E879F9", "#F59E0B", "#3B82F6", "#EF4444", "#10B981", "#F97316"];

export type CategoryPoint = { name: string; revenue: number };

export function CategoryChart({ data }: { data: CategoryPoint[] }) {
  if (!data.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <h3 className="mb-4 font-semibold">Revenue by category</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={100} fontSize={11} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.5)" />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [peso(Number(v)), "Revenue"]}
            />
            <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {data.map((_, i) => (
                <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type HourPoint = { hour: number; count: number; revenue: number };

export function HourlyChart({ data }: { data: HourPoint[] }) {
  const rows = data.map((d) => ({
    label: d.hour === 0 ? "12am" : d.hour < 12 ? `${d.hour}am` : d.hour === 12 ? "12pm" : `${d.hour - 12}pm`,
    count: d.count,
    revenue: d.revenue / 100,
  }));
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <h3 className="mb-4 font-semibold">Peak hours</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 0, right: 4, bottom: 0, left: -28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" fontSize={9} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" interval={1} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="rgba(255,255,255,0.4)" />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v, name) => name === "revenue" ? [peso(Number(v)), "Revenue"] : [Number(v), "Sales"]}
            />
            <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type PaymentPoint = { method: string; total: number };

const METHOD_COLORS: Record<string, string> = {
  cash: "#2DD4BF",
  card: "#7C3AED",
  gcash: "#3B82F6",
  maya: "#10B981",
  other: "#F59E0B",
};

export function PaymentMethodChart({ data }: { data: PaymentPoint[] }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <h3 className="mb-2 font-semibold">Payment methods</h3>
      <div className="flex items-center gap-4">
        <div className="relative size-32 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="method" innerRadius={38} outerRadius={56} paddingAngle={2} strokeWidth={0}>
                {data.map((d, i) => (
                  <Cell key={d.method} fill={METHOD_COLORS[d.method] ?? CAT_COLORS[i % CAT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v) => [peso(Number(v) / 100), ""]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 text-sm">
          {data.map((d) => (
            <div key={d.method} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: METHOD_COLORS[d.method] ?? "#888" }}
                />
                <span className="capitalize text-muted-foreground">{d.method}</span>
              </div>
              <div className="text-right">
                <span className="font-medium">{peso(d.total / 100)}</span>
                <span className="ml-1 text-xs text-muted-foreground">
                  {total > 0 ? `${((d.total / total) * 100).toFixed(0)}%` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MarginDonut({
  marginPct,
  revenue,
  profit,
}: {
  marginPct: number;
  revenue: number;
  profit: number;
}) {
  const data = [
    { name: "Profit", value: Math.max(marginPct, 0) },
    { name: "Cost", value: Math.max(100 - marginPct, 0) },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <h3 className="font-semibold">Gross margin</h3>
      <div className="relative mx-auto mt-2 h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <linearGradient id="marginGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2DD4BF" />
                <stop offset="100%" stopColor="#7C3AED" />
              </linearGradient>
            </defs>
            <Pie data={data} dataKey="value" startAngle={90} endAngle={-270} innerRadius={62} outerRadius={80} paddingAngle={2} strokeWidth={0}>
              <Cell fill="url(#marginGrad)" />
              <Cell fill="rgba(255,255,255,0.08)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold">{marginPct.toFixed(0)}%</span>
          <span className="text-xs text-muted-foreground">margin</span>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Revenue</span>
          <span className="font-medium">{peso(revenue)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Gross profit</span>
          <span className="font-medium text-teal-300">{peso(profit)}</span>
        </div>
      </div>
    </div>
  );
}
