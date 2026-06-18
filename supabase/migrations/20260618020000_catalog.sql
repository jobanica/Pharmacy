-- ============================================================================
-- Milestone 3 — Catalog: categories, products, suppliers.
--
-- All org-scoped. SELECT is open to every org member (the POS/cashier needs to
-- read products); writes require manage_catalog (owner/manager/pharmacist).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  created_at      timestamptz not null default now()
);
create index categories_organization_id_idx on public.categories (organization_id);
create unique index categories_org_name_unique_idx
  on public.categories (organization_id, lower(name));

-- ---------------------------------------------------------------------------
-- products — selling price lives here (centavos); cost is per-batch (M4)
-- ---------------------------------------------------------------------------
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  category_id           uuid references public.categories (id) on delete set null,
  name                  text not null check (length(trim(name)) > 0),
  generic_name          text,
  sku                   text,
  barcode               text,
  unit                  text not null default 'piece',
  requires_prescription boolean not null default false,
  reorder_point         integer not null default 0 check (reorder_point >= 0),
  default_price_centavos integer not null default 0 check (default_price_centavos >= 0),
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);
create index products_organization_id_idx on public.products (organization_id);
create index products_category_id_idx on public.products (category_id);
-- Barcode and SKU are unique within an organization (when present).
create unique index products_org_barcode_unique_idx
  on public.products (organization_id, barcode) where barcode is not null;
create unique index products_org_sku_unique_idx
  on public.products (organization_id, sku) where sku is not null;

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index suppliers_organization_id_idx on public.suppliers (organization_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products   enable row level security;
alter table public.suppliers  enable row level security;

-- Writes allowed for owner/manager/pharmacist (manage_catalog).
-- categories
create policy "org members view categories"
  on public.categories for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "catalog managers write categories"
  on public.categories for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- products
create policy "org members view products"
  on public.products for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "catalog managers write products"
  on public.products for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- suppliers
create policy "org members view suppliers"
  on public.suppliers for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "catalog managers write suppliers"
  on public.suppliers for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );
