-- ============================================================================
-- Milestone 9 — Billing scaffold (Xendit). One subscription row per org.
-- Inert in dev (feature-flagged off); never gates core features.
-- ============================================================================

create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null unique references public.organizations (id) on delete cascade,
  plan                   text not null default 'free',
  status                 text not null default 'active',
  xendit_customer_id     text,
  xendit_plan_id         text,
  xendit_subscription_id text,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Owner-only visibility/management; the Xendit webhook updates rows via the
-- service role (which bypasses RLS).
create policy "owners view subscription"
  on public.subscriptions for select to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  );
create policy "owners update subscription"
  on public.subscriptions for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  )
  with check (organization_id = public.auth_org_id());
