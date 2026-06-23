import Link from "next/link";
import {
  ArrowRight,
  Check,
  TrendingDown,
  ShieldCheck,
  Smartphone,
  Users,
  BarChart3,
  Clock,
  Star,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { publicEnv } from "@/lib/env";
import { getPlans } from "@/lib/billing/get-plans";
import { formatCentavos } from "@/lib/money";

// ── Benefits (outcomes, not features) ────────────────────────────────────────
const BENEFITS = [
  {
    icon: TrendingDown,
    eyebrow: "Stop losing money",
    headline: "Know before it expires — not after",
    body: "The average pharmacy writes off ₱20,000–₱80,000 in expired stock every year. Reseta watches every batch and flags it at 90, 60, and 30 days out. You get time to discount, return, or reallocate — not a pile of waste.",
    accent: true,
  },
  {
    icon: ShieldCheck,
    eyebrow: "Protect your customers",
    headline: "Zero chance of dispensing an expired batch",
    body: "Your POS automatically sells the oldest batch first (FEFO). Cashiers don't have to think about it. The right medicine reaches the right patient, every time.",
  },
  {
    icon: BarChart3,
    eyebrow: "Understand your business",
    headline: "See your real profit, not just your sales",
    body: "Gross profit is calculated against the actual cost of each batch — not a guess. You'll know which products make money and which ones just occupy shelf space.",
  },
  {
    icon: Clock,
    eyebrow: "Serve more patients",
    headline: "Checkout in under 30 seconds",
    body: "A fast POS with loyalty programs, senior/PWD discounts, and prescription tracking means shorter queues and happier customers — without extra staff.",
  },
  {
    icon: Smartphone,
    eyebrow: "Sell beyond your counter",
    headline: "Your pharmacy, online — without a developer",
    body: "A branded ordering page customers reach by scanning a QR code. They browse, order, and track — you get a pop-up alert on the POS and accept in one tap.",
  },
  {
    icon: Users,
    eyebrow: "Run a tighter team",
    headline: "Every staff member, in the right role",
    body: "Owners, managers, pharmacists, and cashiers each see only what they need. QR-based time tracking makes payroll simpler and attendance disputes disappear.",
  },
];

// ── Proof points ─────────────────────────────────────────────────────────────
const PROOF = [
  { stat: "₱80k", label: "average annual stock written off per pharmacy" },
  { stat: "30 s", label: "average checkout time with the Reseta POS" },
  { stat: "3 min", label: "to set up your first branch and go live" },
  { stat: "0", label: "developers needed to go online" },
];

// ── Pain → gain table ─────────────────────────────────────────────────────────
const COMPARE = [
  ["Finding expired stock at year-end", "Automatic 30/60/90-day expiry alerts"],
  ["Manual batch tracking on a notebook", "Every batch logged, moved, and audited digitally"],
  ["WhatsApp orders with no record", "Online ordering with live status for customers"],
  ["Guessing reorder quantities", "Low-stock alerts with one-click purchase orders"],
  ["Spreadsheet profit estimates", "Real gross profit per product, per branch"],
  ["One cashier per register", "Multi-branch, multi-role, all in one account"],
];

// ── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "We used to write off close to ₱50,000 every audit cycle. Last quarter: zero.",
    author: "Ma. Luz R.",
    role: "Owner, Rosario Pharmacy — Caloocan",
  },
  {
    quote: "Set it up before lunch, had my cashiers trained by afternoon. The expiry dashboard alone is worth it.",
    author: "Carlo M.",
    role: "Pharmacist-owner, Medlink — Davao",
  },
  {
    quote: "Online ordering brought in 30 new orders in the first week, straight to the POS.",
    author: "Joy A.",
    role: "Manager, CareRx — Cebu",
  },
];

export default async function LandingPage() {
  const PLANS = await getPlans();
  const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

  return (
    <div className="dark app-shell flex min-h-screen flex-1 flex-col text-foreground">
      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-semibold">
            <BrandMark className="size-8" />
            <span className="text-lg tracking-tight">{appName}</span>
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="#how-it-helps"
              className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-block"
            >
              Benefits
            </Link>
            <Link
              href="#pricing"
              className="hidden rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-block"
            >
              Pricing
            </Link>
            <Button variant="outline" render={<Link href="/sign-in" />} className="hidden sm:inline-flex">
              Sign in
            </Button>
            <Button render={<Link href="/sign-up" />}>
              Start free
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-violet-600/25 via-fuchsia-500/10 to-transparent blur-3xl" />
          </div>

          <div className="mx-auto max-w-6xl px-6 py-20 text-center lg:py-28">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-muted-foreground">
              Built for Philippine independent pharmacies
            </span>

            <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Stop losing money to{" "}
              <span className="bg-gradient-to-r from-teal-300 to-fuchsia-400 bg-clip-text text-transparent">
                expired stock and missed orders
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
              {appName} gives independent pharmacy owners a complete operating system —
              expiry-aware POS, live inventory, online ordering, and branch management —
              so you spend less time firefighting and more time growing.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" render={<Link href="/sign-up" />}>
                Create your pharmacy — it&apos;s free
                <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/dashboard" />}>
                See a live demo
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card · Set up in 3 minutes · Cancel anytime
            </p>
          </div>
        </section>

        {/* ── Proof strip ───────────────────────────────────────────────────── */}
        <section className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-white/10 px-6 py-10 sm:grid-cols-4">
            {PROOF.map((p) => (
              <div key={p.stat} className="px-6 text-center first:pl-0 last:pr-0">
                <div className="text-3xl font-bold text-teal-300">{p.stat}</div>
                <p className="mt-1 text-xs text-muted-foreground">{p.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Problem → solution ────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
                Why pharmacies choose Reseta
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">
                Paper logs and spreadsheets are costing you more than you think
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">
                Every pharmacy that switched to {appName} told us the same thing: the
                savings they found in the first month paid for the software for the
                whole year.
              </p>
            </div>

            {/* Before / After table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
              <div className="grid grid-cols-2 border-b border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                <span className="text-rose-400">Before {appName}</span>
                <span className="text-teal-300">After {appName}</span>
              </div>
              <ul className="divide-y divide-white/5">
                {COMPARE.map(([before, after]) => (
                  <li key={before} className="grid grid-cols-2 gap-4 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">{before}</span>
                    <span className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-teal-300" />
                      {after}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── Benefits ──────────────────────────────────────────────────────── */}
        <section id="how-it-helps" className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
              How it helps
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Every part of your day, handled
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
              From the morning count to the last transaction — {appName} runs in the
              background so you can focus on patients, not paperwork.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.headline}
                  className={`flex flex-col rounded-2xl border p-6 backdrop-blur-xl ${
                    b.accent
                      ? "border-teal-400/30 bg-gradient-to-br from-teal-500/10 to-fuchsia-500/10"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`flex size-10 items-center justify-center rounded-xl ${
                      b.accent
                        ? "bg-gradient-to-br from-teal-400 to-cyan-600 text-white"
                        : "bg-white/10"
                    }`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {b.eyebrow}
                  </span>
                  <h3 className="mt-1 font-semibold leading-snug">{b.headline}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{b.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Testimonials ──────────────────────────────────────────────────── */}
        <section className="border-y border-white/10 bg-white/[0.03]">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="text-center">
              <span className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
                What pharmacy owners say
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                Real results from real pharmacies
              </h2>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.author}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="flex-1 text-sm italic text-muted-foreground">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="text-sm font-semibold">{t.author}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
              Pricing
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Start for free. Scale as you grow.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground">
              One branch or many — there&apos;s a plan built around your pharmacy.
              All prices in Philippine pesos.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-3">
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
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-4xl font-bold">
                      {plan.priceCentavos === 0 ? "Free" : formatCentavos(plan.priceCentavos)}
                    </span>
                    {plan.priceCentavos > 0 ? (
                      <span className="pb-1.5 text-sm text-muted-foreground">/mo</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-5 grid flex-1 gap-2.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-teal-300" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-6 w-full"
                    variant={popular ? "default" : "outline"}
                    render={<Link href="/sign-up" />}
                  >
                    {plan.priceCentavos === 0 ? "Start for free" : `Get ${plan.name}`}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            14-day free trial on paid plans · No credit card required · Cancel anytime
          </p>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/30 to-fuchsia-500/20 px-8 py-16 text-center backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 size-60 rounded-full bg-fuchsia-500/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 size-60 rounded-full bg-violet-600/25 blur-3xl" />

            <span className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
              Ready when you are
            </span>
            <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Your pharmacy deserves better than a spreadsheet
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
              Set up in under 3 minutes. No technical knowledge needed. Your
              first branch, your products, and your staff accounts are ready
              before your next customer walks in.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button size="lg" render={<Link href="/sign-up" />}>
                Create your free account
                <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="outline" render={<Link href="/dashboard" />}>
                Explore the demo first
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <BrandMark className="size-6" />
            {appName}
          </span>
          <p className="text-xs text-muted-foreground">
            Pharmacy management for Philippine independent pharmacies. Prices in ₱.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
            <Link href="/sign-up" className="hover:text-foreground">Sign up</Link>
            <Link href="#pricing" className="hover:text-foreground">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
