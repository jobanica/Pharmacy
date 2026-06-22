-- ============================================================================
-- Milestone 5 — Cashier shifts.
--
-- One open shift per branch at a time. Sales are linked to the active shift
-- so cash reconciliation can be done per-cashier per-session.
-- ============================================================================

create type public.shift_status as enum ('open', 'closed');

create table public.cashier_shifts (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  branch_id               uuid not null references public.branches (id) on delete cascade,
  cashier_id              uuid references auth.users (id) on delete set null,
  status                  public.shift_status not null default 'open',
  opening_cash_centavos   integer not null default 0,
  closing_cash_centavos   integer,
  opened_at               timestamptz not null default now(),
  closed_at               timestamptz,
  notes                   text,
  -- reconciliation snapshot written at close
  sales_count             integer,
  gross_centavos          integer,
  discount_centavos       integer,
  net_centavos            integer,
  cash_collected_centavos integer,   -- sum of cash tenders during shift
  expected_cash_centavos  integer,   -- opening_cash + cash_collected
  over_short_centavos     integer    -- closing_cash - expected_cash (negative = short)
);

create index cashier_shifts_org_idx    on public.cashier_shifts (organization_id, opened_at desc);
create index cashier_shifts_branch_idx on public.cashier_shifts (branch_id, status);

alter table public.cashier_shifts enable row level security;

create policy "org members view shifts"
  on public.cashier_shifts for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "members open shifts"
  on public.cashier_shifts for insert to authenticated
  with check (organization_id = public.auth_org_id());

create policy "members update own open shifts"
  on public.cashier_shifts for update to authenticated
  using (organization_id = public.auth_org_id());

-- Link sales to shifts (nullable — sales before this migration have no shift).
alter table public.sales
  add column if not exists shift_id uuid references public.cashier_shifts (id) on delete set null;

create index if not exists sales_shift_idx on public.sales (shift_id);

-- ============================================================================
-- open_shift(p_branch, p_opening_cash) — create a new shift for the branch.
-- Raises if that branch already has an open shift.
-- ============================================================================
create or replace function public.open_shift(
  p_branch               uuid,
  p_opening_cash         integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org  uuid;
  v_id   uuid;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then raise exception 'Branch not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Branch is not in your organization'; end if;

  if exists (
    select 1 from public.cashier_shifts
    where branch_id = p_branch and status = 'open'
  ) then
    raise exception 'A shift is already open for this branch. Close it before opening a new one.';
  end if;

  insert into public.cashier_shifts (organization_id, branch_id, cashier_id, opening_cash_centavos)
  values (v_org, p_branch, auth.uid(), p_opening_cash)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.open_shift(uuid, integer) to authenticated;

-- ============================================================================
-- close_shift(p_shift, p_closing_cash, p_notes) — close a shift and compute
-- cash reconciliation. Returns a JSONB summary.
-- ============================================================================
create or replace function public.close_shift(
  p_shift         uuid,
  p_closing_cash  integer default 0,
  p_notes         text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org               uuid;
  v_branch            uuid;
  v_opening           integer;
  v_sales_count       integer;
  v_gross             integer;
  v_discount          integer;
  v_net               integer;
  v_cash_collected    integer;
  v_expected          integer;
  v_over_short        integer;
begin
  select organization_id, branch_id, opening_cash_centavos
  into v_org, v_branch, v_opening
  from public.cashier_shifts
  where id = p_shift and status = 'open';

  if v_org is null then raise exception 'Shift not found or already closed'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Shift is not in your organization'; end if;

  -- Aggregate sales that belong to this shift.
  select
    count(*)::integer,
    coalesce(sum(subtotal_centavos), 0)::integer,
    coalesce(sum(discount_centavos), 0)::integer,
    coalesce(sum(total_centavos), 0)::integer
  into v_sales_count, v_gross, v_discount, v_net
  from public.sales
  where shift_id = p_shift and status = 'completed';

  -- Cash collected = sum of cash tender rows during this shift.
  select coalesce(sum(sp.amount_centavos), 0)::integer
  into v_cash_collected
  from public.sale_payments sp
  join public.sales s on s.id = sp.sale_id
  where s.shift_id = p_shift and s.status = 'completed' and sp.method = 'cash';

  v_expected   := v_opening + v_cash_collected;
  v_over_short := p_closing_cash - v_expected;

  update public.cashier_shifts set
    status                  = 'closed',
    closing_cash_centavos   = p_closing_cash,
    closed_at               = now(),
    notes                   = p_notes,
    sales_count             = v_sales_count,
    gross_centavos          = v_gross,
    discount_centavos       = v_discount,
    net_centavos            = v_net,
    cash_collected_centavos = v_cash_collected,
    expected_cash_centavos  = v_expected,
    over_short_centavos     = v_over_short
  where id = p_shift;

  return jsonb_build_object(
    'shift_id',              p_shift,
    'sales_count',           v_sales_count,
    'gross_centavos',        v_gross,
    'discount_centavos',     v_discount,
    'net_centavos',          v_net,
    'cash_collected_centavos', v_cash_collected,
    'expected_cash_centavos',  v_expected,
    'closing_cash_centavos',   p_closing_cash,
    'over_short_centavos',     v_over_short
  );
end;
$$;

grant execute on function public.close_shift(uuid, integer, text) to authenticated;
