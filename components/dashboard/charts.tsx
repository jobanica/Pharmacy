"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const PALETTE = ["#0F766E", "#2DD4BF", "#0EA5E9", "#6366F1", "#F59E0B", "#EF4444", "#84CC16", "#EC4899"];

const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(n);

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export function RevenueChart({ data }: { data: { day: string; revenue: number }[] }) {
  return (
    <ChartCard title="Revenue over time">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="day" fontSize={11} tickLine={false} />
          <YAxis fontSize={11} tickLine={false} width={50} />
          <Tooltip formatter={(v) => peso(Number(v))} />
          <Line type="monotone" dataKey="revenue" stroke="#0F766E" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TopProductsChart({ data }: { data: { name: string; total: number }[] }) {
  return (
    <ChartCard title="Top products by revenue">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
          <XAxis type="number" fontSize={11} tickLine={false} hide />
          <YAxis type="category" dataKey="name" fontSize={11} width={90} tickLine={false} />
          <Tooltip formatter={(v) => peso(Number(v))} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function DonutCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => peso(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
            {d.name}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}

export function CategoryChart({ data }: { data: { name: string; value: number }[] }) {
  return <DonutCard title="Category performance" data={data} />;
}

export function PaymentChart({ data }: { data: { name: string; value: number }[] }) {
  return <DonutCard title="Payment mix" data={data} />;
}
