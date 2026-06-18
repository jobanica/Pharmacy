-- ============================================================================
-- Milestone 5 — POS: sales + sale_items, and atomic complete_sale / void_sale.
--
-- complete_sale and void_sale are SECURITY DEFINER (they must deduct/restore
-- batches even for a cashier, who has no general batch-write permission) but
-- enforce tenant scope themselves: the branch's organization MUST equal the
-- caller's org (auth_org_id), and roles are checked where required.
-- ============================================================================

create type public.payment_method as enum ('cash');
create type public.sale_status as enum ('completed', 'voided');

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
create table public.sales (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations (id) on delete cascade,
  branch_id               uuid not null references public.branches (id) on delete cascade,
  receipt_number          text not null,
  cashier_id              uuid references auth.users (id) on delete set null,
  subtotal_centavos       integer not null default 0,
  discount_centavos       integer not null default 0 check (discount_centavos >= 0),
  total_centavos          integer not null default 0 check (total_centavos >= 0),
  payment_method          public.payment_method not null default 'cash',
  amount_tendered_centavos integer not null default 0,
  change_centavos         integer not null default 0,
  status                  public.sale_status not null default 'completed',
  voided_by               uuid references auth.users (id) on delete set null,
  voided_at               timestamptz,
  created_at              timestamptz not null default now(),
  unique (branch_id, receipt_number)
);
create index sales_org_idx on public.sales (organization_id);
create index sales_branch_created_idx on public.sales (branch_id, created_at desc);

-- ---------------------------------------------------------------------------
-- sale_items — one row per (product, batch) consumed (FEFO may split a line)
-- ---------------------------------------------------------------------------
create table public.sale_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  sale_id             uuid not null references public.sales (id) on delete cascade,
  product_id          uuid not null references public.products (id) on delete restrict,
  batch_id            uuid references public.batches (id) on delete set null,
  quantity            integer not null check (quantity > 0),
  unit_price_centavos integer not null,
  line_total_centavos integer not null,
  unit_cost_centavos  integer not null default 0, -- snapshot for profit (M8)
  created_at          timestamptz not null default now()
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- sales: members read; any member may create (cashier included); owner/manager
-- may update (void). No delete.
create policy "org members view sales"
  on public.sales for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "members create sales"
  on public.sales for insert to authenticated
  with check (organization_id = public.auth_org_id());
create policy "managers void sales"
  on public.sales for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager']::public.user_role[])
  )
  with check (organization_id = public.auth_org_id());

create policy "org members view sale items"
  on public.sale_items for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "members create sale items"
  on public.sale_items for insert to authenticated
  with check (organization_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- complete_sale — create a sale, deduct stock FEFO, log movements (atomic).
-- p_items: jsonb array of { "product_id": uuid, "quantity": int }.
-- Unit prices are taken server-side from products (automatic pricing).
-- ---------------------------------------------------------------------------
create or replace function public.complete_sale(
  p_branch uuid,
  p_items jsonb,
  p_discount_centavos integer default 0,
  p_amount_tendered_centavos integer default 0,
  p_payment_method public.payment_method default 'cash'
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
  item        jsonb;
  v_pid       uuid;
  v_qty       integer;
  v_price     integer;
  v_remaining integer;
  b           record;
  v_take      integer;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then
    raise exception 'Branch not found';
  end if;
  if v_org <> public.auth_org_id() then
    raise exception 'Branch is not in your organization';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  -- Serialize receipt numbering per branch.
  perform 1 from public.branches where id = p_branch for update;
  select lpad((count(*) + 1)::text, 6, '0') into v_receipt
  from public.sales where branch_id = p_branch;

  insert into public.sales (
    organization_id, branch_id, receipt_number, cashier_id,
    subtotal_centavos, discount_centavos, total_centavos,
    payment_method, amount_tendered_centavos, change_centavos, status
  )
  values (
    v_org, p_branch, v_receipt, auth.uid(),
    0, v_discount, 0, p_payment_method, v_tendered, 0, 'completed'
  )
  returning id into v_sale;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity';
    end if;

    select default_price_centavos into v_price
    from public.products where id = v_pid and organization_id = v_org;
    if v_price is null then
      raise exception 'Product not found in your organization';
    end if;

    v_subtotal := v_subtotal + v_price * v_qty;

    -- FEFO across non-expired batches at this branch.
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
      values (
        v_org, v_sale, v_pid, b.id, v_take,
        v_price, v_price * v_take, b.cost_centavos
      );

      insert into public.inventory_movements (
        organization_id, branch_id, product_id, batch_id, type,
        quantity_delta, reference_id, reason, created_by
      )
      values (
        v_org, p_branch, v_pid, b.id, 'sale',
        -v_take, v_sale, 'Sale ' || v_receipt, auth.uid()
      );

      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'Insufficient stock to complete the sale';
    end if;
  end loop;

  v_total := greatest(v_subtotal - v_discount, 0);
  if v_tendered < v_total then
    raise exception 'Amount tendered is less than the total due';
  end if;

  update public.sales set
    subtotal_centavos = v_subtotal,
    total_centavos = v_total,
    change_centavos = v_tendered - v_total
  where id = v_sale;

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- void_sale — reverse a completed sale: restore batches + log 'void' movements.
-- Owner/manager only.
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
  if not found then
    raise exception 'Sale not found';
  end if;
  if s.organization_id <> public.auth_org_id() then
    raise exception 'Sale is not in your organization';
  end if;
  if not public.has_org_role(array['owner','manager']::public.user_role[]) then
    raise exception 'Only an owner or manager can void a sale';
  end if;
  if s.status = 'voided' then
    raise exception 'Sale is already voided';
  end if;

  for it in select product_id, batch_id, quantity from public.sale_items where sale_id = p_sale
  loop
    if it.batch_id is not null then
      update public.batches set quantity = quantity + it.quantity where id = it.batch_id;
    end if;
    insert into public.inventory_movements (
      organization_id, branch_id, product_id, batch_id, type,
      quantity_delta, reference_id, reason, created_by
    )
    values (
      s.organization_id, s.branch_id, it.product_id, it.batch_id, 'void',
      it.quantity, p_sale, 'Void ' || s.receipt_number, auth.uid()
    );
  end loop;

  update public.sales
  set status = 'voided', voided_by = auth.uid(), voided_at = now()
  where id = p_sale;
end;
$$;

grant execute on function public.complete_sale(uuid, jsonb, integer, integer, public.payment_method) to authenticated;
grant execute on function public.void_sale(uuid) to authenticated;
