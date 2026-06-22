-- ============================================================================
-- Milestone 9 — Clinical layer.
--
-- Adds drug metadata to products and a manually-managed interaction registry.
-- Controlled substance levels align with RA 9165 / DOH classifications.
-- ============================================================================

-- Controlled substance classification (null = not controlled).
-- 'dangerous'  — Schedule 1/2 (e.g. opioids, amphetamines) — strict logbook
-- 'regulated'  — Schedule 3/4 (e.g. benzodiazepines, codeine combinations)
-- 'precursor'  — PDEA precursor chemicals
create type public.controlled_substance_level as enum ('dangerous', 'regulated', 'precursor');

-- Clinical metadata columns on products.
alter table public.products
  add column if not exists drug_class             text,
  add column if not exists storage_conditions     text,
  add column if not exists contraindications      text,
  add column if not exists side_effects           text,
  add column if not exists controlled_level       public.controlled_substance_level;

create index if not exists products_drug_class_idx
  on public.products (organization_id, drug_class)
  where drug_class is not null;

create index if not exists products_controlled_idx
  on public.products (organization_id, controlled_level)
  where controlled_level is not null;

-- ============================================================================
-- Drug interaction registry.
-- Interactions are bidirectional (a↔b); only one row needed per pair.
-- ============================================================================
create type public.interaction_severity as enum ('minor', 'moderate', 'major');

create table public.drug_interactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id_a    uuid not null references public.products (id) on delete cascade,
  product_id_b    uuid not null references public.products (id) on delete cascade,
  severity        public.interaction_severity not null default 'moderate',
  description     text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint interactions_no_self_pair check (product_id_a <> product_id_b),
  constraint interactions_canonical_order check (product_id_a < product_id_b)
);

create index drug_interactions_org_idx on public.drug_interactions (organization_id);
create index drug_interactions_a_idx   on public.drug_interactions (product_id_a);
create index drug_interactions_b_idx   on public.drug_interactions (product_id_b);

alter table public.drug_interactions enable row level security;

create policy "org members view interactions"
  on public.drug_interactions for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers manage interactions"
  on public.drug_interactions for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- ============================================================================
-- check_interactions(p_product_ids uuid[]) → table of interactions found.
-- Called from the POS with the current cart product IDs.
-- ============================================================================
create or replace function public.check_interactions(
  p_product_ids  uuid[]
)
returns table (
  product_id_a  uuid,
  product_id_b  uuid,
  severity      public.interaction_severity,
  description   text,
  name_a        text,
  name_b        text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    di.product_id_a,
    di.product_id_b,
    di.severity,
    di.description,
    pa.name as name_a,
    pb.name as name_b
  from public.drug_interactions di
  join public.products pa on pa.id = di.product_id_a
  join public.products pb on pb.id = di.product_id_b
  where di.organization_id = public.auth_org_id()
    and di.product_id_a = any(p_product_ids)
    and di.product_id_b = any(p_product_ids);
$$;

grant execute on function public.check_interactions(uuid[]) to authenticated;
