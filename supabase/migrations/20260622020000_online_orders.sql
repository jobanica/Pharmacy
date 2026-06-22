-- ============================================================================
-- Online ordering — public storefront orders for pickup or delivery.
--   Customers (no login) place orders via the storefront; orders land in a
--   staff queue to accept and fulfill. Stock is NOT deducted here — staff ring
--   the order up at the POS when fulfilling. Prices are computed server-side in
--   place_order() so the client cannot tamper with them.
-- ============================================================================
create type public.order_status as enum (
  'pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'
);
create type public.fulfillment_type as enum ('pickup', 'delivery');
create type public.order_payment as enum ('on_fulfillment', 'online');

create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  branch_id         uuid not null references public.branches (id) on delete cascade,
  order_number      text not null,
  customer_name     text not null check (length(trim(customer_name)) > 0),
  customer_phone    text not null check (length(trim(customer_phone)) > 0),
  fulfillment       public.fulfillment_type not null,
  payment           public.order_payment not null default 'on_fulfillment',
  status            public.order_status not null default 'pending',
  delivery_address  text,
  delivery_lat      double precision,
  delivery_lng      double precision,
  notes             text,
  subtotal_centavos integer not null default 0,
  total_centavos    integer not null default 0,
  created_at        timestamptz not null default now()
);
create index orders_org_idx on public.orders (organization_id, created_at desc);
create index orders_branch_idx on public.orders (branch_id, status);

create table public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  order_id            uuid not null references public.orders (id) on delete cascade,
  product_id          uuid references public.products (id) on delete set null,
  product_name        text not null,
  quantity            integer not null check (quantity > 0),
  unit_price_centavos integer not null,
  line_total_centavos integer not null
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- RLS: org members read + update their orders. Inserts come from place_order
-- (security definer) called server-side, so no public insert policy is needed.
-- ---------------------------------------------------------------------------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "org members view orders"
  on public.orders for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "org members update orders"
  on public.orders for update to authenticated
  using (organization_id = public.auth_org_id())
  with check (organization_id = public.auth_org_id());

create policy "org members view order items"
  on public.order_items for select to authenticated
  using (organization_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- place_order — validate the branch, price items from the catalog, generate a
-- per-org order number, and insert the order + items atomically.
-- p_items: jsonb array of { product_id, quantity }.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_org uuid,
  p_branch uuid,
  p_name text,
  p_phone text,
  p_fulfillment text,
  p_payment text,
  p_items jsonb,
  p_address text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_notes text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order    uuid;
  v_number   text;
  v_subtotal integer := 0;
  item       jsonb;
  v_pid      uuid;
  v_qty      integer;
  v_price    integer;
  v_name     text;
  v_fulfil   public.fulfillment_type := p_fulfillment::public.fulfillment_type;
  v_pay      public.order_payment := p_payment::public.order_payment;
begin
  -- Branch must belong to the org and be active.
  perform 1 from public.branches
    where id = p_branch and organization_id = p_org and is_active;
  if not found then raise exception 'Branch not available'; end if;

  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Name is required'; end if;
  if length(trim(coalesce(p_phone, ''))) = 0 then raise exception 'Phone is required'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if v_fulfil = 'delivery' and length(trim(coalesce(p_address, ''))) = 0 then
    raise exception 'A delivery address is required';
  end if;

  select 'ORD-' || lpad((count(*) + 1)::text, 5, '0')
    into v_number from public.orders where organization_id = p_org;

  insert into public.orders (
    organization_id, branch_id, order_number, customer_name, customer_phone,
    fulfillment, payment, status, delivery_address, delivery_lat, delivery_lng, notes
  )
  values (
    p_org, p_branch, v_number, trim(p_name), trim(p_phone),
    v_fulfil, v_pay, 'pending',
    case when v_fulfil = 'delivery' then nullif(trim(p_address), '') end,
    case when v_fulfil = 'delivery' then p_lat end,
    case when v_fulfil = 'delivery' then p_lng end,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_order;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then continue; end if;

    select default_price_centavos, name into v_price, v_name
    from public.products
    where id = v_pid and organization_id = p_org and is_active;
    if not found then raise exception 'A product in your cart is unavailable'; end if;

    insert into public.order_items (
      organization_id, order_id, product_id, product_name,
      quantity, unit_price_centavos, line_total_centavos
    )
    values (p_org, v_order, v_pid, v_name, v_qty, v_price, v_price * v_qty);

    v_subtotal := v_subtotal + v_price * v_qty;
  end loop;

  update public.orders
    set subtotal_centavos = v_subtotal, total_centavos = v_subtotal
    where id = v_order;

  return v_number;
end;
$$;
