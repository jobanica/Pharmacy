-- ============================================================================
-- Online orders: delivery fee.
-- The fee is configured in Settings → Online store (organizations.settings ->
-- storefront -> delivery_fee_centavos) and applied by place_order to delivery
-- orders, so the customer can't tamper with it.
-- ============================================================================
alter table public.orders
  add column if not exists delivery_fee_centavos integer not null default 0;

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
  v_fee      integer := 0;
  item       jsonb;
  v_pid      uuid;
  v_qty      integer;
  v_price    integer;
  v_name     text;
  v_fulfil   public.fulfillment_type := p_fulfillment::public.fulfillment_type;
  v_pay      public.order_payment := p_payment::public.order_payment;
begin
  perform 1 from public.branches
    where id = p_branch and organization_id = p_org and is_active;
  if not found then raise exception 'Branch not available'; end if;

  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Name is required'; end if;
  if length(trim(coalesce(p_phone, ''))) = 0 then raise exception 'Phone is required'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if v_fulfil = 'delivery' and length(trim(coalesce(p_address, ''))) = 0 then
    raise exception 'A delivery address is required';
  end if;

  -- Delivery fee comes from the org's storefront settings (server-authoritative).
  if v_fulfil = 'delivery' then
    select greatest(coalesce((settings #>> '{storefront,delivery_fee_centavos}')::int, 0), 0)
      into v_fee
      from public.organizations where id = p_org;
  end if;

  select 'ORD-' || lpad((count(*) + 1)::text, 5, '0')
    into v_number from public.orders where organization_id = p_org;

  insert into public.orders (
    organization_id, branch_id, order_number, customer_name, customer_phone,
    fulfillment, payment, status, delivery_address, delivery_lat, delivery_lng, notes,
    delivery_fee_centavos
  )
  values (
    p_org, p_branch, v_number, trim(p_name), trim(p_phone),
    v_fulfil, v_pay, 'pending',
    case when v_fulfil = 'delivery' then nullif(trim(p_address), '') end,
    case when v_fulfil = 'delivery' then p_lat end,
    case when v_fulfil = 'delivery' then p_lng end,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_fee
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
    set subtotal_centavos = v_subtotal,
        total_centavos = v_subtotal + v_fee
    where id = v_order;

  return v_number;
end;
$$;
