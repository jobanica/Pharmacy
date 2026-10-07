-- ============================================================================
-- CANVEXIA agent portal integration.
--
-- Reseta reports what happened (signups, submitted payments, cancellations) and
-- reacts to what the portal sends back (contract signed, payment confirmed /
-- rejected / reversed). No commission logic lives here.
--
-- Events are queued in product_event_outbox inside the same transaction as the
-- business change and delivered later by a cron worker, so a portal outage can
-- never fail a signup. Callbacks are deduped through product_callback_inbox.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Customer account fields
-- ---------------------------------------------------------------------------
alter table public.organizations
  add column if not exists agent_code text,
  add column if not exists contract_status text not null default 'unsigned'
    check (contract_status in ('unsigned', 'signed')),
  add column if not exists contract_signed_at timestamptz,
  add column if not exists contract_minimum_term_ends_at timestamptz;

create index if not exists organizations_agent_code_idx
  on public.organizations (agent_code) where agent_code is not null;

-- ---------------------------------------------------------------------------
-- 2. Outbox / inbox / manual payments
-- ---------------------------------------------------------------------------
create table if not exists public.product_event_outbox (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  event_id        text not null unique,
  type            text not null,
  payload         jsonb not null,
  -- pending -> sent, or -> failed when the portal says it can never accept it.
  status          text not null default 'pending'
                    check (status in ('pending', 'sent', 'failed')),
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status     integer,
  last_error      text,
  -- The portal's answer: processed | pending | duplicate | refused.
  portal_status   text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index if not exists product_event_outbox_due_idx
  on public.product_event_outbox (status, next_attempt_at);
-- Events for one customer must be delivered in the order they were created.
create index if not exists product_event_outbox_org_order_idx
  on public.product_event_outbox (organization_id, created_at);

create table if not exists public.product_callback_inbox (
  event_id    text primary key,
  type        text not null,
  payload     jsonb not null,
  received_at timestamptz not null default now(),
  -- What applying it did ("applied", or why it was skipped).
  outcome     text
);

create table if not exists public.subscription_manual_payments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  type                text not null check (type in ('activation', 'monthly')),
  months_covered      integer not null default 1 check (months_covered between 1 and 24),
  billing_month_start date,
  amount_centavos     integer not null check (amount_centavos > 0),
  -- Refuse a bank reference this product has already seen.
  bank_reference      text not null unique,
  receipt_path        text,
  status              text not null default 'submitted'
                        check (status in ('submitted', 'confirmed', 'rejected', 'reversed')),
  reason              text,
  event_id            text unique,
  submitted_by        uuid references auth.users (id) on delete set null,
  submitted_at        timestamptz not null default now(),
  decided_at          timestamptz
);
create index if not exists subscription_manual_payments_org_idx
  on public.subscription_manual_payments (organization_id, submitted_at desc);

-- Outbox and inbox are machine tables: service-role only, no policies.
alter table public.product_event_outbox enable row level security;
alter table public.product_callback_inbox enable row level security;

-- Owners may read their own payment history (the billing page shows status).
-- Writes happen server-side with the service role.
alter table public.subscription_manual_payments enable row level security;
drop policy if exists "org members view their manual payments" on public.subscription_manual_payments;
create policy "org members view their manual payments"
  on public.subscription_manual_payments for select to authenticated
  using (organization_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- 3. Queue customer.signed_up
--
-- Shared by the signup trigger and the "admin added a code later" path so the
-- event is built in exactly one place. Idempotent: one signup event per org.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_customer_signed_up(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      public.organizations%rowtype;
  v_name     text;
  v_phone    text;
begin
  select * into v_org from public.organizations where id = p_org;
  if v_org.id is null or v_org.agent_code is null then return; end if;

  -- Only ever one signup event per customer.
  if exists (
    select 1 from public.product_event_outbox
    where organization_id = p_org and type = 'customer.signed_up'
  ) then
    return;
  end if;

  select p.full_name, p.phone into v_name, v_phone
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org and m.role = 'owner'
  order by m.created_at asc
  limit 1;

  insert into public.product_event_outbox (organization_id, event_id, type, payload)
  values (
    p_org,
    'evt_' || gen_random_uuid()::text,
    'customer.signed_up',
    jsonb_build_object(
      'event_id', 'evt_' || gen_random_uuid()::text,
      'type', 'customer.signed_up',
      'occurred_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'data', jsonb_build_object(
        'external_customer_id', p_org::text,
        'business_name', v_org.name,
        'owner_name', coalesce(nullif(trim(v_name), ''), v_org.name),
        'owner_phone', coalesce(nullif(trim(v_phone), ''), ''),
        'agent_code', v_org.agent_code,
        'plan', v_org.plan
      )
    )
  );
end;
$$;

-- Keep the stored event_id and the payload's event_id identical.
create or replace function public.product_event_outbox_sync_event_id()
returns trigger
language plpgsql
as $$
begin
  new.payload := jsonb_set(new.payload, '{event_id}', to_jsonb(new.event_id));
  return new;
end;
$$;

drop trigger if exists product_event_outbox_sync_event_id on public.product_event_outbox;
create trigger product_event_outbox_sync_event_id
  before insert on public.product_event_outbox
  for each row execute function public.product_event_outbox_sync_event_id();

-- ---------------------------------------------------------------------------
-- 4. agent_code is set once at signup and never edited afterwards
-- ---------------------------------------------------------------------------
create or replace function public.organizations_agent_code_guard()
returns trigger
language plpgsql
as $$
begin
  if old.agent_code is not null and new.agent_code is distinct from old.agent_code then
    raise exception 'agent_code cannot be changed once set';
  end if;
  -- An admin attaching a code later still reports the signup to the portal.
  if old.agent_code is null and new.agent_code is not null then
    perform public.enqueue_customer_signed_up(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_agent_code_guard on public.organizations;
create trigger organizations_agent_code_guard
  after update of agent_code on public.organizations
  for each row execute function public.organizations_agent_code_guard();

-- ---------------------------------------------------------------------------
-- 5. Sign-up: carry agent_code onto the organization and queue the event in the
--    same transaction that creates the org.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id     uuid;
  v_branch_id  uuid;
  v_slug       text;
  v_agent_code text;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );

  if new.raw_user_meta_data ? 'org_name' then
    v_slug := public.slugify(new.raw_user_meta_data ->> 'org_name')
              || '-' || substr(md5(random()::text), 1, 6);
    v_agent_code := nullif(trim(upper(coalesce(new.raw_user_meta_data ->> 'agent_code', ''))), '');

    insert into public.organizations (name, slug, agent_code)
    values (new.raw_user_meta_data ->> 'org_name', v_slug, v_agent_code)
    returning id into v_org_id;

    insert into public.branches (organization_id, name)
    values (
      v_org_id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'branch_name'), ''), 'Main Branch')
    )
    returning id into v_branch_id;

    insert into public.memberships (organization_id, user_id, role, default_branch_id, status)
    values (v_org_id, new.id, 'owner', v_branch_id, 'active');

    -- Same transaction as the org: the event cannot be lost, and a portal
    -- outage cannot fail the signup.
    if v_agent_code is not null then
      perform public.enqueue_customer_signed_up(v_org_id);
    end if;
  end if;

  return new;
end;
$$;
