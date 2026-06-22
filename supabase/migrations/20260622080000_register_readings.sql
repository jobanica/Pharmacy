-- ============================================================================
-- Milestone 1 (Tax & receipts) — Step 3: register_readings (X / Z readings).
--
-- X-reading: current-shift snapshot (non-destructive; can be printed any time).
-- Z-reading: end-of-day close (non-resettable, sequential z_counter per org,
--            immutable after insert — no UPDATE/DELETE via RLS).
--
-- BIR CAS note: Z-readings must be printed and kept on file per RR 11-2004.
-- The z_counter must never reset after go-live.
-- ============================================================================

create type public.reading_type as enum ('x', 'z');

-- Per-org Z-counter (gapless, same pattern as or_sequences).
create table public.z_counters (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_z          bigint not null default 0
);
alter table public.z_counters enable row level security;
create policy "org owners read z_counters"
  on public.z_counters for select to authenticated
  using (organization_id = public.auth_org_id());

insert into public.z_counters (organization_id)
select id from public.organizations
on conflict do nothing;

create or replace function public.seed_z_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.z_counters (organization_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger trg_seed_z_counter
  after insert on public.organizations
  for each row execute function public.seed_z_counter();

-- ---------------------------------------------------------------------------
-- register_readings — one row per X or Z event
-- ---------------------------------------------------------------------------
create table public.register_readings (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  branch_id             uuid not null references public.branches (id) on delete cascade,
  type                  public.reading_type not null,
  z_counter             bigint,               -- null for X; sequential for Z
  cashier_id            uuid references auth.users (id) on delete set null,
  opened_at             timestamptz not null, -- start of period being summarised
  closed_at             timestamptz not null default now(),
  opening_cash_centavos integer not null default 0,

  -- Sales counts & amounts
  sales_count           integer not null default 0,
  gross_centavos        integer not null default 0,
  discount_centavos     integer not null default 0,
  points_discount_centavos integer not null default 0,
  net_centavos          integer not null default 0,

  -- VAT breakdown (BIR-required)
  vatable_centavos      integer not null default 0,
  vat_centavos          integer not null default 0,
  vat_exempt_centavos   integer not null default 0,
  zero_rated_centavos   integer not null default 0,

  -- Tender breakdown
  cash_centavos         integer not null default 0,
  card_centavos         integer not null default 0,
  gcash_centavos        integer not null default 0,
  maya_centavos         integer not null default 0,
  other_centavos        integer not null default 0,

  -- Immutable audit snapshot
  raw_snapshot          jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index register_readings_org_branch_idx
  on public.register_readings (organization_id, branch_id, created_at desc);

alter table public.register_readings enable row level security;

create policy "org members view readings"
  on public.register_readings for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers create readings"
  on public.register_readings for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- Z-readings are immutable after close.
create policy "no update readings"
  on public.register_readings for update to authenticated
  using (false);
create policy "no delete readings"
  on public.register_readings for delete to authenticated
  using (false);

-- ---------------------------------------------------------------------------
-- close_reading(p_branch, p_type, p_opening_cash, p_opened_at)
-- Aggregates all completed sales for the period, writes a reading row, and
-- (for Z) advances the z_counter.  Returns the reading id.
-- ---------------------------------------------------------------------------
create or replace function public.close_reading(
  p_branch          uuid,
  p_type            public.reading_type,
  p_opening_cash    integer default 0,
  p_opened_at       timestamptz default null   -- null = since last Z (or epoch)
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org         uuid;
  v_vat_rate    numeric;
  v_period_from timestamptz;
  v_z_no        bigint := null;
  v_id          uuid;
  agg           record;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then raise exception 'Branch not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Not your branch'; end if;
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'Insufficient role to close a reading';
  end if;

  -- VAT rate from org settings (default 12 %).
  select coalesce((settings #>> '{tax,vat_rate_pct}')::numeric, 12)
  into v_vat_rate
  from public.organizations where id = v_org;

  -- Period start: explicit arg, last Z close for this branch, or epoch.
  if p_opened_at is not null then
    v_period_from := p_opened_at;
  else
    select coalesce(max(closed_at), '1970-01-01'::timestamptz)
    into v_period_from
    from public.register_readings
    where branch_id = p_branch and type = 'z';
  end if;

  -- For Z-reading: advance counter (serialised by FOR UPDATE on z_counters).
  if p_type = 'z' then
    update public.z_counters
    set last_z = last_z + 1
    where organization_id = v_org
    returning last_z into v_z_no;
  end if;

  -- Aggregate sales in the period.
  select
    count(*)                                       as sales_count,
    coalesce(sum(s.subtotal_centavos), 0)          as gross_centavos,
    coalesce(sum(s.discount_centavos), 0)          as discount_centavos,
    coalesce(sum(s.points_redeemed * 100), 0)      as points_discount_centavos,
    coalesce(sum(s.total_centavos), 0)             as net_centavos,
    -- VAT-inclusive breakdown: gross_excl = net / (1 + rate)
    coalesce(sum(round(s.total_centavos / (1 + v_vat_rate / 100))), 0) as vatable_centavos,
    coalesce(sum(s.total_centavos - round(s.total_centavos / (1 + v_vat_rate / 100))), 0) as vat_centavos
  into agg
  from public.sales s
  where s.branch_id = p_branch
    and s.status = 'completed'
    and s.created_at >= v_period_from
    and s.created_at < now();

  -- Tender breakdown from sale_payments.
  insert into public.register_readings (
    organization_id, branch_id, type, z_counter, cashier_id,
    opened_at, opening_cash_centavos,
    sales_count, gross_centavos, discount_centavos, points_discount_centavos, net_centavos,
    vatable_centavos, vat_centavos, vat_exempt_centavos, zero_rated_centavos,
    cash_centavos, card_centavos, gcash_centavos, maya_centavos, other_centavos,
    raw_snapshot
  )
  select
    v_org, p_branch, p_type, v_z_no, auth.uid(),
    v_period_from, p_opening_cash,
    agg.sales_count, agg.gross_centavos, agg.discount_centavos,
    agg.points_discount_centavos, agg.net_centavos,
    agg.vatable_centavos, agg.vat_centavos, 0, 0,
    coalesce(sum(case when sp.method = 'cash'  then sp.amount_centavos else 0 end), 0),
    coalesce(sum(case when sp.method = 'card'  then sp.amount_centavos else 0 end), 0),
    coalesce(sum(case when sp.method = 'gcash' then sp.amount_centavos else 0 end), 0),
    coalesce(sum(case when sp.method = 'maya'  then sp.amount_centavos else 0 end), 0),
    coalesce(sum(case when sp.method not in ('cash','card','gcash','maya') then sp.amount_centavos else 0 end), 0),
    jsonb_build_object(
      'period_from', v_period_from,
      'period_to',   now(),
      'vat_rate_pct', v_vat_rate
    )
  from public.sale_payments sp
  join public.sales s on s.id = sp.sale_id
  where s.branch_id = p_branch
    and s.status = 'completed'
    and s.created_at >= v_period_from
    and s.created_at < now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.close_reading(uuid, public.reading_type, integer, timestamptz) to authenticated;
