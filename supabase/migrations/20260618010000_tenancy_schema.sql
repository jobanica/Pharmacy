-- ============================================================================
-- Milestone 2 — Tenancy & auth schema
-- organizations, branches, profiles, memberships, invitations + enums.
-- RLS is enabled here but policies live in the companion *_rls migration so
-- the helper functions they depend on exist first.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto (preinstalled on Supabase).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('owner', 'manager', 'pharmacist', 'cashier');
create type public.membership_status as enum ('active', 'suspended');

-- ---------------------------------------------------------------------------
-- organizations — the tenant (a pharmacy business / account)
-- ---------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  slug        text not null unique,
  plan        text not null default 'free',
  status      text not null default 'active',
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- branches — belong to an organization
-- ---------------------------------------------------------------------------
create table public.branches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  address         text,
  phone           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index branches_organization_id_idx on public.branches (organization_id);

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- memberships — a user belongs to exactly ONE organization with a role
-- ---------------------------------------------------------------------------
create table public.memberships (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  role              public.user_role not null,
  default_branch_id uuid references public.branches (id) on delete set null,
  status            public.membership_status not null default 'active',
  created_at        timestamptz not null default now(),
  -- One org per user (Section 4: "belongs to one organization").
  unique (user_id)
);
create index memberships_organization_id_idx on public.memberships (organization_id);

-- ---------------------------------------------------------------------------
-- invitations — invite by email + role, accepted via token
-- ---------------------------------------------------------------------------
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null,
  role            public.user_role not null,
  token           text not null unique,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  invited_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index invitations_organization_id_idx on public.invitations (organization_id);
create index invitations_email_idx on public.invitations (lower(email));
-- At most one pending invite per email per org.
create unique index invitations_pending_unique_idx
  on public.invitations (organization_id, lower(email))
  where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Enable RLS now; policies are added in the *_rls migration.
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.branches      enable row level security;
alter table public.profiles      enable row level security;
alter table public.memberships   enable row level security;
alter table public.invitations   enable row level security;
