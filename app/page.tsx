import Link from "next/link";
import {
  CalendarClock,
  BellRing,
  ShoppingCart,
  LineChart,
  ShieldCheck,
  Building2,
  ArrowRight,
  CircleAlert,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { publicEnv } from "@/lib/env";
import { getPlans } from "@/lib/billing/get-plans";
import { formatCentavos } from "@/lib/money";

const BENEFITS = [
  {
    icon: CalendarClock,
    title: "Catch expiries before they cost you",
    body: "Every batch carries its expiry date. Reseta buckets stock into 90, 60, and 30-day windows — and flags what's already expired — so you sell, discount, or return it in time.",
    primary: true,
  },
  {
    icon: BellRing,
    title: "Never run out of a fast mover",
    body: "Per-product reorder points trigger low-stock alerts with one-click purchase orders to the right supplier.",
  },
  {
    icon: ShoppingCart,
    title: "Checkout that protects margins",
    body: "Barcode POS that deducts stock First-Expiry-First-Out automatically — the oldest batch always sells first.",
  },
  {
    icon: ShieldCheck,
    title: "Trace every unit",
    body: "An immutable movement log records every receive, sale, adjustment, and write-off. Nothing disappears unexplained.",
  },
  {
    icon: LineChart,
    title: "Know your real profit",
    body: "Revenue, gross profit (sell − cost), and top sellers per branch — cost is snapshotted per batch, so margins are accurate.",
  },
  {
    icon: Building2,
    title: "Built for many branches",
    body: "Fully isolated per pharmacy business, with multiple branches and roles for owners, managers, pharmacists, and cashiers.",
  },
];

const BUCKETS = [
  { label: "Expired", value: 2, tone: "text-rose-400" },
  { label: "≤30 days", value: 5, tone: "text-rose-300" },
  { label: "≤60 days", value: 8, tone: "text-amber-300" },
  { label: "≤90 days", value: 12, tone: "text-teal-300" },
];

export default async function LandingPage() {
  const PLANS = await getPlans();
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

  return (
    <div className="dark app-shell flex min-h-screen flex-1 flex-col text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 font-semibold">
          <BrandMark className="size-8" />
          <span className="text-lg tracking-tight">{appName}</span>
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="#pricing"
            className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-block"
          >
            Pricing
          </Link>
          <Button render={<Link href="/dashboard" />}>Open app</Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
              <CircleAlert className="size-3.5 text-teal-300" />
              Expiry tracking, built in
            </span>
            <h1 className="mt-5 text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Stop throwing away{" "}
              <span className="bg-gradient-to-r from-teal-300 to-fuchsia-400 bg-clip-text text-transparent">
                expired medicine
              </span>
            </h1>
            <p className="mt-4 text-pretty text-lg text-muted-foreground">
              Expired stock is money on the shelf you can&apos;t sell. {appName}{" "}
              monitors every batch&apos;s expiry and alerts you at 90, 60, and 30
              days out — so nothing slips past its date unnoticed. Plus fast POS,
              batch inventory, and profit insights for your pharmacy.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" render={<Link href="/dashboard" />}>
                Explore the demo
                <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/sign-up" />}>
                Create your pharmacy
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Multi-tenant SaaS · Built for Philippine pharmacies · Prices in ₱
            </p>
          </div>

          {/* Expiry-alert mock */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-violet-600/30 to-fuchsia-500/20 blur-2xl" />
            <div className="relative rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <CalendarClock className="size-4 text-teal-300" />
                  Expiring stock — Main Branch
                </span>
                <span className="text-xs text-muted-foreground">Asia/Manila</span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {BUCKETS.map((b) => (
                  <div key={b.label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                    <div className={`text-2xl font-bold ${b.tone}`}>{b.value}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{b.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {[
                  { name: "Amoxil 500mg", note: "Batch B005 · 12 days left", tone: "text-rose-300" },
                  { name: "Neozep Forte", note: "Batch B012 · 28 days left", tone: "text-amber-300" },
                  { name: "Losartan 50mg", note: "Batch B003 · expired", tone: "text-rose-400" },
                ].map((r) => (
                  <div key={r.name} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className={`text-xs ${r.tone}`}>{r.note}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/alerts"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-fuchsia-300 hover:underline"
              >
                Write off or reorder <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Less shrinkage. Fewer stockouts. Clearer profit.
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
            The day-to-day jobs that keep an independent pharmacy profitable —
            handled in one place.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`rounded-2xl border p-6 backdrop-blur-xl ${
                    f.primary
                      ? "border-teal-400/30 bg-gradient-to-br from-teal-500/10 to-fuchsia-500/10"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`flex size-10 items-center justify-center rounded-xl ${
                      f.primary
                        ? "bg-gradient-to-br from-teal-400 to-cyan-600 text-white"
                        : "bg-white/10 text-foreground"
                    }`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto w-full max-w-6xl px-6 pb-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Simple pricing that grows with you
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
            Start free. Upgrade when you add branches and staff. Prices in ₱ per
            month.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-3">
            {PLANS.map((plan) => {
              const popular = plan.id === "starter";
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur-xl ${
                    popular
                      ? "border-fuchsia-400/40 bg-gradient-to-br from-violet-600/20 to-fuchsia-500/15 shadow-lg shadow-fuchsia-600/10"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  {popular ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-1 text-xs font-medium text-white">
                      Most popular
                    </span>
                  ) : null}
                  <h3 className="font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-3xl font-bold">
                      {plan.priceCentavos === 0 ? "Free" : formatCentavos(plan.priceCentavos)}
                    </span>
                    {plan.priceCentavos > 0 ? (
                      <span className="pb-1 text-sm text-muted-foreground">/mo</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-4 grid flex-1 gap-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="size-4 shrink-0 text-teal-300" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={popular ? "default" : "outline"}
                    render={<Link href="/sign-up" />}
                  >
                    {plan.priceCentavos === 0 ? "Start free" : `Choose ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            14-day free trial on paid plans · No card required · Cancel anytime
          </p>
        </section>

        {/* CTA band */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/30 to-fuchsia-500/20 p-10 text-center backdrop-blur-xl">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-fuchsia-500/30 blur-3xl" />
            <h2 className="text-2xl font-semibold tracking-tight">
              Protect your margins from the expiry shelf
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Spin up your pharmacy in seconds — it creates your organization,
              first branch, and owner account automatically.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button size="lg" render={<Link href="/dashboard" />}>
                Open the demo
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/sign-up" />}>
                Get started free
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-6 text-center text-xs text-muted-foreground">
        {appName} · Pharmacy management for the Philippines
      </footer>
    </div>
  );
}
