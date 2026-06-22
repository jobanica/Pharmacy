-- ============================================================================
-- Milestone 4 — complete_sale v6: multi-tender support.
--
-- p_tenders: jsonb array of {method text, amount_centavos int}.
--   If provided (and non-empty), it overrides p_payment_method /
--   p_amount_tendered_centavos for tender recording. Each tender is written to
--   sale_payments. The sum must cover the total due.
--
-- Backward compat: if p_tenders is null/empty the old single-tender path is
-- used unchanged, so existing callers continue to work.
-- ============================================================================
create or replace function public.complete_sale(
  p_branch                    uuid,
  p_items                     jsonb,
  p_discount_centavos         integer  default 0,
  p_amount_tendered_centavos  integer  default 0,
  p_payment_method            public.payment_method default 'cash',
  p_customer                  uuid     default null,
  p_redeem_points             integer  default 0,
  p_discount_type             text     default 'none',
  p_beneficiary_id_no         text     default null,
  p_beneficiary_name          text     default null,
  p_prescription_id           uuid     default null,
  p_tenders                   jsonb    default null   -- [{method, amount_centavos}]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org             uuid;
  v_plan            text;
  v_track           boolean;
  v_vat_rate        numeric;
  v_receipt         text;
  v_sale            uuid;
  v_subtotal        integer := 0;
  v_total           integer;
  v_sc_pwd_disc     integer := 0;
  v_manual_disc     integer := greatest(coalesce(p_discount_centavos, 0), 0);
  v_discount        integer;
  v_vat_exempt      integer := 0;
  v_tendered        integer := 0;   -- will be computed from tenders
  v_change          integer;
  v_redeem_pts      integer := 0;
  v_redeem_cts      integer := 0;
  v_earn_pts        integer := 0;
  v_per_point_cts   numeric;
  v_balance         integer;
  v_dtype           text;
  v_needs_rx        boolean := false;
  v_is_split        boolean := false;
  v_primary_method  public.payment_method;
  item              jsonb;
  tender            jsonb;
  v_pid             uuid;
  v_qty             integer;
  v_price           integer;
  v_req_rx          boolean;
  v_remaining       integer;
  b                 record;
  v_take            integer;
  v_t_method        text;
  v_t_amount        integer;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then raise exception 'Branch not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Branch is not in your organization'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;

  select plan into v_plan from public.organizations where id = v_org;
  v_track := coalesce(v_plan, 'free') in ('starter', 'pro');

  select coalesce((settings #>> '{tax,vat_rate_pct}')::numeric, 12)
  into v_vat_rate
  from public.organizations where id = v_org;

  v_dtype := coalesce(p_discount_type, 'none');
  if v_dtype not in ('none', 'sc', 'pwd', 'manual') then v_dtype := 'none'; end if;

  if p_prescription_id is not null then
    if not exists (
      select 1 from public.prescriptions
      where id = p_prescription_id and organization_id = v_org
    ) then
      raise exception 'Prescription not found in your organization';
    end if;
  end if;

  -- Resolve tenders.
  if p_tenders is not null and jsonb_array_length(p_tenders) > 0 then
    v_is_split := jsonb_array_length(p_tenders) > 1;
    -- Primary method = first tender's method.
    v_primary_method := ((p_tenders -> 0) ->> 'method')::public.payment_method;
    -- Total tendered = sum of all tender amounts.
    select coalesce(sum(((t ->> 'amount_centavos')::integer)), 0)
    into v_tendered
    from jsonb_array_elements(p_tenders) t;
  else
    -- Legacy single-tender path.
    v_is_split := false;
    v_primary_method := p_payment_method;
    v_tendered := greatest(coalesce(p_amount_tendered_centavos, 0), 0);
  end if;

  if p_customer is not null then
    select points_balance into v_balance from public.customers
    where id = p_customer and organization_id = v_org for update;
    if v_balance is null then raise exception 'Customer not found'; end if;
  end if;

  v_receipt := public.generate_or_number(v_org);

  insert into public.sales (
    organization_id, branch_id, receipt_number, cashier_id,
    subtotal_centavos, discount_centavos, total_centavos,
    payment_method, amount_tendered_centavos, change_centavos, status, customer_id,
    discount_type, beneficiary_id_no, beneficiary_name, vat_exempt_centavos,
    prescription_id, is_split_tender
  )
  values (
    v_org, p_branch, v_receipt, auth.uid(),
    0, 0, 0, v_primary_method, v_tendered, 0, 'completed', p_customer,
    v_dtype, p_beneficiary_id_no, p_beneficiary_name, 0,
    p_prescription_id, v_is_split
  )
  returning id into v_sale;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;

    select default_price_centavos, requires_prescription
    into v_price, v_req_rx
    from public.products where id = v_pid and organization_id = v_org;
    if v_price is null then raise exception 'Product not found in your organization'; end if;

    if v_req_rx then v_needs_rx := true; end if;
    v_subtotal := v_subtotal + v_price * v_qty;

    if v_dtype in ('sc', 'pwd') then
      v_sc_pwd_disc := v_sc_pwd_disc +
        (v_price - round(v_price / (1 + v_vat_rate / 100) * 0.8)) * v_qty;
    end if;

    if not v_track then
      insert into public.sale_items (
        organization_id, sale_id, product_id, batch_id, quantity,
        unit_price_centavos, line_total_centavos, unit_cost_centavos
      )
      values (v_org, v_sale, v_pid, null, v_qty, v_price, v_price * v_qty, 0);
    else
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
    end if;
  end loop;

  if v_needs_rx and p_prescription_id is null then
    raise exception 'A prescription is required for one or more items in the cart';
  end if;

  if v_dtype in ('sc', 'pwd') then
    v_discount := least(v_sc_pwd_disc, v_subtotal);
  else
    v_discount := least(v_manual_disc, v_subtotal);
  end if;

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

  v_change := v_tendered - v_total;

  if v_dtype in ('sc', 'pwd') then v_vat_exempt := v_total; end if;

  if p_customer is not null then
    select greatest(coalesce((settings #>> '{loyalty,peso_per_point}')::numeric, 20), 1) * 100
      into v_per_point_cts
      from public.organizations where id = v_org;
    if v_per_point_cts is null or v_per_point_cts <= 0 then v_per_point_cts := 2000; end if;
    v_earn_pts := floor(v_total / v_per_point_cts);
  end if;

  update public.sales set
    subtotal_centavos    = v_subtotal,
    discount_centavos    = v_discount,
    total_centavos       = v_total,
    change_centavos      = v_change,
    points_redeemed      = v_redeem_pts,
    points_earned        = v_earn_pts,
    vat_exempt_centavos  = v_vat_exempt
  where id = v_sale;

  -- Write individual tender rows.
  if p_tenders is not null and jsonb_array_length(p_tenders) > 0 then
    for tender in select * from jsonb_array_elements(p_tenders)
    loop
      v_t_method := tender ->> 'method';
      v_t_amount := (tender ->> 'amount_centavos')::integer;
      if v_t_amount is null or v_t_amount <= 0 then continue; end if;
      insert into public.sale_payments (organization_id, sale_id, method, amount_centavos, reference)
      values (v_org, v_sale, v_t_method, v_t_amount, tender ->> 'reference');
    end loop;
  else
    insert into public.sale_payments (organization_id, sale_id, method, amount_centavos)
    values (v_org, v_sale, v_primary_method::text, v_tendered);
  end if;

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

grant execute on function public.complete_sale(uuid, jsonb, integer, integer, public.payment_method, uuid, integer, text, text, text, uuid, jsonb) to authenticated;
