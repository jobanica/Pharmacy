-- ============================================================================
-- Loyalty & rewards: customers earn points on sales, redeem them for discounts.
--   Earn:   1 point per ₱20 paid (floor(total_centavos / 2000))
--   Redeem: 1 point = ₱1 discount (point value = 100 centavos)
-- Points are awarded/redeemed atomically inside complete_sale; voids reverse.
-- ============================================================================

create type public.loyalty_kind as enum ('earn', 'redeem', 'adjust');

create table public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (length(trim(name)) > 0),
  phone           text,
  email           text,
  points_balance  integer not null default 0,
  created_at      timestamptz not null default now()
);
create index customers_org_idx on public.customers (organization_id);
create unique index customers_org_phone_idx
  on public.customers (organization_id, phone) where phone is not null;

create table public.loyalty_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id     uuid not null references public.customers (id) on delete cascade,
  sale_id         uuid references public.sales (id) on delete set null,
  kind            public.loyalty_kind not null,
  points          integer not null,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index loyalty_tx_customer_idx on public.loyalty_transactions (customer_id, created_at desc);
create index loyalty_tx_org_idx on public.loyalty_transactions (organization_id);

-- Attach a customer + points to sales.
alter table public.sales add column customer_id uuid references public.customers (id) on delete set null;
alter table public.sales add column points_earned integer not null default 0;
alter table public.sales add column points_redeemed integer not null default 0;

-- ---------------------------------------------------------------------------
-- RLS: org-scoped. Any member (incl. cashier) can read/create customers at the
-- POS; owner/manager can delete. Loyalty ledger is read by members, written by
-- complete_sale (definer); append-only.
-- ---------------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.loyalty_transactions enable row level security;

create policy "org members view customers"
  on public.customers for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "org members create customers"
  on public.customers for insert to authenticated
  with check (organization_id = public.auth_org_id());
create policy "org members update customers"
  on public.customers for update to authenticated
  using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());
create policy "managers delete customers"
  on public.customers for delete to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager']::public.user_role[])
  );

create policy "org members view loyalty tx"
  on public.loyalty_transactions for select to authenticated
  using (organization_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- complete_sale v2 — now also redeems + awards loyalty points.
-- ---------------------------------------------------------------------------
drop function if exists public.complete_sale(uuid, jsonb, integer, integer, public.payment_method);

create or replace function public.complete_sale(
  p_branch uuid,
  p_items jsonb,
  p_discount_centavos integer default 0,
  p_amount_tendered_centavos integer default 0,
  p_payment_method public.payment_method default 'cash',
  p_customer uuid default null,
  p_redeem_points integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org       uuid;
  v_receipt   text;
  v_sale      uuid;
  v_subtotal  integer := 0;
  v_total     integer;
  v_discount  integer := greatest(coalesce(p_discount_centavos, 0), 0);
  v_tendered  integer := greatest(coalesce(p_amount_tendered_centavos, 0), 0);
  v_redeem_pts integer := 0;
  v_redeem_cts integer := 0;
  v_earn_pts  integer := 0;
  v_balance   integer;
  item        jsonb;
  v_pid       uuid;
  v_qty       integer;
  v_price     integer;
  v_remaining integer;
  b           record;
  v_take      integer;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then raise exception 'Branch not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Branch is not in your organization'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;

  if p_customer is not null then
    select points_balance into v_balance from public.customers
    where id = p_customer and organization_id = v_org for update;
    if v_balance is null then raise exception 'Customer not found'; end if;
  end if;

  perform 1 from public.branches where id = p_branch for update;
  select lpad((count(*) + 1)::text, 6, '0') into v_receipt
  from public.sales where branch_id = p_branch;

  insert into public.sales (
    organization_id, branch_id, receipt_number, cashier_id,
    subtotal_centavos, discount_centavos, total_centavos,
    payment_method, amount_tendered_centavos, change_centavos, status, customer_id
  )
  values (
    v_org, p_branch, v_receipt, auth.uid(),
    0, v_discount, 0, p_payment_method, v_tendered, 0, 'completed', p_customer
  )
  returning id into v_sale;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;

    select default_price_centavos into v_price
    from public.products where id = v_pid and organization_id = v_org;
    if v_price is null then raise exception 'Product not found in your organization'; end if;

    v_subtotal := v_subtotal + v_price * v_qty;

    v_remaining := v_qty;
    for b in
      select id, quantity, cost_centavos
      from public.batches
      where branch_id = p_branch and product_id = v_pid and quantity > 0
        and (expiry_date is null or expiry_date >= (timezone('Asia/Manila', now()))::date)
      order by expiry_date asc nulls last, received_at asc
      for update
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, b.quantity);
      update public.batches set quantity = quantity - v_take where id = b.id;
      insert into public.sale_items (
        organization_id, sale_id, product_id, batch_id, quantity,
        unit_price_centavos, line_total_centavos, unit_cost_centavos
      )
      values (v_org, v_sale, v_pid, b.id, v_take, v_price, v_price * v_take, b.cost_centavos);
      insert into public.inventory_movements (
        organization_id, branch_id, product_id, batch_id, type,
        quantity_delta, reference_id, reason, created_by
      )
      values (v_org, p_branch, v_pid, b.id, 'sale', -v_take, v_sale, 'Sale ' || v_receipt, auth.uid());
      v_remaining := v_remaining - v_take;
    end loop;
    if v_remaining > 0 then raise exception 'Insufficient stock to complete the sale'; end if;
  end loop;

  -- Redeem points (1 point = 100 centavos), capped to balance and to the
  -- remaining amount after any manual discount.
  if p_customer is not null and coalesce(p_redeem_points, 0) > 0 then
    v_redeem_pts := least(p_redeem_points, v_balance);
    v_redeem_cts := v_redeem_pts * 100;
    if v_redeem_cts > greatest(v_subtotal - v_discount, 0) then
      v_redeem_cts := greatest(v_subtotal - v_discount, 0);
      v_redeem_pts := v_redeem_cts / 100;
      v_redeem_cts := v_redeem_pts * 100;
    end if;
  end if;

  v_total := greatest(v_subtotal - v_discount - v_redeem_cts, 0);
  if v_tendered < v_total then raise exception 'Amount tendered is less than the total due'; end if;

  if p_customer is not null then
    v_earn_pts := floor(v_total / 2000);
  end if;

  update public.sales set
    subtotal_centavos = v_subtotal,
    total_centavos = v_total,
    change_centavos = v_tendered - v_total,
    points_redeemed = v_redeem_pts,
    points_earned = v_earn_pts
  where id = v_sale;

  if p_customer is not null then
    update public.customers
    set points_balance = greatest(points_balance - v_redeem_pts + v_earn_pts, 0)
    where id = p_customer;
    if v_redeem_pts > 0 then
      insert into public.loyalty_transactions (organization_id, customer_id, sale_id, kind, points, created_by)
      values (v_org, p_customer, v_sale, 'redeem', -v_redeem_pts, auth.uid());
    end if;
    if v_earn_pts > 0 then
      insert into public.loyalty_transactions (organization_id, customer_id, sale_id, kind, points, created_by)
      values (v_org, p_customer, v_sale, 'earn', v_earn_pts, auth.uid());
    end if;
  end if;

  return v_sale;
end;
$$;

grant execute on function public.complete_sale(uuid, jsonb, integer, integer, public.payment_method, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- void_sale v2 — also reverse any loyalty points from the sale.
-- ---------------------------------------------------------------------------
create or replace function public.void_sale(p_sale uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s   public.sales%rowtype;
  it  record;
begin
  select * into s from public.sales where id = p_sale;
  if not found then raise exception 'Sale not found'; end if;
  if s.organization_id <> public.auth_org_id() then raise exception 'Sale is not in your organization'; end if;
  if not public.has_org_role(array['owner','manager']::public.user_role[]) then
    raise exception 'Only an owner or manager can void a sale';
  end if;
  if s.status = 'voided' then raise exception 'Sale is already voided'; end if;

  for it in select product_id, batch_id, quantity from public.sale_items where sale_id = p_sale
  loop
    if it.batch_id is not null then
      update public.batches set quantity = quantity + it.quantity where id = it.batch_id;
    end if;
    insert into public.inventory_movements (
      organization_id, branch_id, product_id, batch_id, type, quantity_delta, reference_id, reason, created_by
    )
    values (s.organization_id, s.branch_id, it.product_id, it.batch_id, 'void', it.quantity, p_sale, 'Void ' || s.receipt_number, auth.uid());
  end loop;

  if s.customer_id is not null and (s.points_earned <> 0 or s.points_redeemed <> 0) then
    update public.customers
    set points_balance = greatest(points_balance + s.points_redeemed - s.points_earned, 0)
    where id = s.customer_id;
    insert into public.loyalty_transactions (organization_id, customer_id, sale_id, kind, points, created_by)
    values (s.organization_id, s.customer_id, p_sale, 'adjust', s.points_redeemed - s.points_earned, auth.uid());
  end if;

  update public.sales set status = 'voided', voided_by = auth.uid(), voided_at = now() where id = p_sale;
end;
$$;
