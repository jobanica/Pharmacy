-- ============================================================================
-- Configurable loyalty earn rate.
--   The pesos-of-net-spend that earn 1 point is now read from
--   organizations.settings -> 'loyalty' ->> 'peso_per_point' (default ₱20).
--   Redeem value is unchanged (1 point = ₱1 = 100 centavos).
-- This re-defines complete_sale; only the earn calculation changed.
-- ============================================================================
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
  v_per_point_cts numeric;
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

  -- Earn points using the org's configured peso-per-point (default ₱20),
  -- converted to centavos. Guard against unset/invalid values.
  if p_customer is not null then
    select greatest(coalesce((settings #>> '{loyalty,peso_per_point}')::numeric, 20), 1) * 100
      into v_per_point_cts
      from public.organizations where id = v_org;
    if v_per_point_cts is null or v_per_point_cts <= 0 then
      v_per_point_cts := 2000;
    end if;
    v_earn_pts := floor(v_total / v_per_point_cts);
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
