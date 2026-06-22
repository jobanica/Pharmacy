-- Editable plan display overrides, managed from the platform admin panel.
-- The plan IDs (free/starter/pro) and feature gating stay in code; only the
-- marketing display (name, price, description, features) is overridable here.
create table if not exists public.plan_overrides (
  id text primary key,
  name text not null,
  price_centavos integer not null default 0 check (price_centavos >= 0),
  description text not null default '',
  features jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.plan_overrides enable row level security;

-- Public read so the landing page and customer billing screen reflect edits.
drop policy if exists "plan_overrides_read" on public.plan_overrides;
create policy "plan_overrides_read" on public.plan_overrides for select using (true);

-- Writes happen only through the service role (platform admin actions), which
-- bypasses RLS; no write policy is granted to anon/authenticated.
