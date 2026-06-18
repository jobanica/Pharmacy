# Reseta — Pharmacy Management (MVP)

<img src="public/reseta-logo.svg" alt="Reseta" width="220" />


Multi-tenant SaaS for independent and small-to-mid Philippine pharmacies.
Replaces paper logbooks and spreadsheets with cloud **POS**, batch-level
**inventory**, **expiry tracking**, **low-stock alerts**, a **sales dashboard**,
and **supplier / purchase-order** management. Each pharmacy business is a fully
isolated tenant that can run multiple branches.

> Status: **Milestone 1 — Foundation** complete. See [Build order](#build-order).

## Tech stack

- **Next.js (App Router) + TypeScript**
- **Tailwind CSS v4 + shadcn/ui** (Base UI), `lucide-react` icons
- **Supabase** — Postgres + Auth + Row Level Security + Storage
- **Zod** validation, **react-hook-form**, **TanStack Table**, **Recharts**
- Money stored as integer **centavos (PHP)**; timestamps `timestamptz`,
  business day reckoned in **Asia/Manila**
- **PayMongo** subscription billing (scaffold only, feature-flagged off)

## Getting started

### 1. Prerequisites

- Node.js 20+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for the local DB, used
  from Milestone 2 onward)

### 2. Install & configure

```bash
npm install
cp .env.example .env.local   # then fill in values
```

| Variable | Scope | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project / local API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key (subject to RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only** | Bypasses RLS — never expose to the browser |
| `NEXT_PUBLIC_APP_NAME` | public | Display name (default `Reseta`) |
| `NEXT_PUBLIC_BILLING_ENABLED` | public | Billing feature flag, `false` in dev |
| `PAYMONGO_SECRET_KEY` | server-only | Only needed when billing is enabled (M9) |
| `PAYMONGO_WEBHOOK_SECRET` | server-only | PayMongo webhook signature secret (M9) |

### 3. Run

```bash
npm run dev      # http://localhost:3000
```

### 4. Database

**Local stack:**

```bash
supabase start                         # boots local Postgres + Auth + Storage
supabase db reset                      # applies supabase/migrations
npm run seed                           # creates the two demo orgs + users
npm run verify:isolation               # proves tenant isolation via RLS
```

**Hosted project (rebuild from scratch):** with the database connection string
exported as `SUPABASE_DB_URL`:

```bash
psql "$SUPABASE_DB_URL" -f scripts/reset.sql                 # DESTRUCTIVE wipe
for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -f "$f"; done
npm run seed
npm run verify:isolation
```

Regenerate typed DB types after schema changes:

```bash
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

### Test accounts

Seeded across **two organizations** to demonstrate tenant isolation. Password
for every account: `Password123!`

| Organization | Email | Role |
| --- | --- | --- |
| MercuryRx Pharmacy | `owner@mercuryrx.ph` | owner |
| MercuryRx Pharmacy | `manager@mercuryrx.ph` | manager |
| MercuryRx Pharmacy | `pharmacist@mercuryrx.ph` | pharmacist (Annex branch) |
| MercuryRx Pharmacy | `cashier@mercuryrx.ph` | cashier |
| GeneriCare Pharmacy | `owner@genericare.ph` | owner |

MercuryRx has two branches (Main, Annex) and one pending invitation; GeneriCare
is a separate tenant used to verify that Org A cannot see Org B's data.

## Architecture overview

### Multi-tenancy

- `organizations` = tenant (a pharmacy business). `branches` belong to an org.
- A user (`profiles`, 1:1 with `auth.users`) belongs to one org via
  `memberships` with a role: `owner` · `manager` · `pharmacist` · `cashier`.
- Almost every domain table carries `organization_id`; branch-scoped tables
  also carry `branch_id`.
- **Row Level Security** on every table: a row is visible/writable only when its
  `organization_id` matches the caller's org, with role checks layered on top.

### Conventions

- Mutations run through **Server Actions** with Zod validation + a role guard at
  the top.
- Inventory is **batch-based**: on-hand for a product at a branch = sum of its
  non-expired batch quantities. Every quantity change appends an immutable
  `inventory_movements` row (the audit trail).
- A sale deducts batches **FEFO** (first-expiry-first-out).
- All money is integer **centavos**; profit = sell price − snapshotted cost.

### Project structure

```
app/
  (app)/            authed shell: pos, inventory, alerts, suppliers,
                    purchase-orders, dashboard, settings
lib/
  supabase/         browser, server, and service-role clients + middleware
  auth/             roles/permissions, app-context session seam
  money/            centavo helpers
  date/             Asia/Manila business-day helpers
  env.ts            validated environment access
components/
  ui/               shadcn/ui primitives
  shell/            sidebar, branch switcher, user menu, page chrome
supabase/
  migrations/       SQL migrations (Milestone 2+)
  seed.sql          demo data
```

## Build order (milestones)

1. **Foundation** ✅ — scaffold, Supabase clients, money/date helpers, app shell.
2. **Tenancy & auth** ✅ — migrations, RLS, sign-up/login/invite, branch switcher.
3. **Catalog** ✅ — categories, products, suppliers (CRUD + RLS + seed, barcode/SKU).
4. **Inventory core** ✅ — batches, movements (audit log), on-hand view, receive/adjust, FEFO helper.
5. POS — cart, checkout transaction, receipt, void.
6. Alerts — low-stock + expiry buckets, CSV export, write-off.
7. Purchase orders — lifecycle + receive-into-batches.
8. Dashboard — metrics, charts, date/branch filters.
9. Billing scaffold + polish.
