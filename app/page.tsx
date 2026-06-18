import Link from "next/link";
import {
  ShoppingCart,
  Package,
  CalendarClock,
  BellRing,
  LineChart,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { publicEnv } from "@/lib/env";

const FEATURES = [
  { icon: ShoppingCart, title: "Fast POS", body: "Barcode/SKU lookup, FEFO stock deduction, and printable receipts." },
  { icon: Package, title: "Batch Inventory", body: "Per-branch stock by batch with a full immutable movement audit trail." },
  { icon: CalendarClock, title: "Expiry Tracking", body: "30/60/90-day expiry buckets and write-offs so nothing expires unnoticed." },
  { icon: BellRing, title: "Low-Stock Alerts", body: "Reorder points per product with one-click purchase orders." },
  { icon: LineChart, title: "Sales Dashboard", body: "Revenue, gross profit, and top products — per branch or org-wide." },
  { icon: Truck, title: "Suppliers & POs", body: "Supplier directory and purchase orders that receive straight into batches." },
];

export default function LandingPage() {
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="flex items-center gap-2 font-semibold">
          <BrandMark className="size-8" />
          {appName}
        </span>
        <Button render={<Link href="/dashboard" />}>Open app</Button>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
          <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
            Multi-tenant SaaS · Built for Philippine pharmacies
          </span>
          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Run your pharmacy without the paper logbooks
          </h1>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            {appName} replaces spreadsheets and logbooks with cloud POS,
            batch-level inventory, expiry alerts, and sales insights — isolated
            per business, across all your branches.
          </p>
          <div className="mt-8 flex gap-3">
            <Button size="lg" render={<Link href="/dashboard" />}>
              Explore the demo
            </Button>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-xl border bg-card p-6">
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-xs text-muted-foreground">
        {appName} · MVP foundation (Milestone 1)
      </footer>
    </div>
  );
}
