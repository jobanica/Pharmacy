-- ============================================================================
-- Milestone 7 — Purchase orders + receive-into-batches.
-- ============================================================================

create type public.po_status as enum ('draft', 'sent', 'received', 'cancelled');

create table public.purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id       uuid not null references public.branches (id) on delete cascade,
  supplier_id     uuid references public.suppliers (id) on delete set null,
  po_number       text not null,
  status          public.po_status not null default 'draft',
  expected_date   date,
  notes           text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, po_number)
);
create index purchase_orders_org_idx on public.purchase_orders (organization_id);
create index purchase_orders_branch_idx on public.purchase_orders (branch_id);

create table public.purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  purchase_order_id   uuid not null references public.purchase_orders (id) on delete cascade,
  product_id          uuid not null references public.products (id) on delete restrict,
  quantity_ordered    integer not null check (quantity_ordered > 0),
  quantity_received   integer not null default 0 check (quantity_received >= 0),
  unit_cost_centavos  integer not null default 0 check (unit_cost_centavos >= 0),
  created_at          timestamptz not null default now()
);
create index po_items_po_idx on public.purchase_order_items (purchase_order_id);

-- ---------------------------------------------------------------------------
-- RLS: members read; manage_catalog (owner/manager/pharmacist) write.
-- ---------------------------------------------------------------------------
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "org members view purchase orders"
  on public.purchase_orders for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "catalog managers write purchase orders"
  on public.purchase_orders for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

create policy "org members view po items"
  on public.purchase_order_items for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "catalog managers write po items"
  on public.purchase_order_items for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- ---------------------------------------------------------------------------
-- create_purchase_order — atomic create with per-org PO number + items.
-- p_items: jsonb array of { product_id, quantity_ordered, unit_cost_centavos }.
-- ---------------------------------------------------------------------------
create or replace function public.create_purchase_order(
  p_branch uuid,
  p_supplier uuid default null,
  p_expected_date date default null,
  p_notes text default null,
  p_items jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org    uuid;
  v_number text;
  v_po     uuid;
  item     jsonb;
begin
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'You do not have permission to manage purchase orders';
  end if;

  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then
    raise exception 'Branch not found';
  end if;
  if v_org <> public.auth_org_id() then
    raise exception 'Branch is not in your organization';
  end if;

  perform 1 from public.organizations where id = v_org for update;
  select 'PO-' || lpad((count(*) + 1)::text, 5, '0') into v_number
  from public.purchase_orders where organization_id = v_org;

  insert into public.purchase_orders (
    organization_id, branch_id, supplier_id, po_number, status, expected_date, notes, created_by
  )
  values (v_org, p_branch, p_supplier, v_number, 'draft', p_expected_date, nullif(p_notes, ''), auth.uid())
  returning id into v_po;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.purchase_order_items (
      organization_id, purchase_order_id, product_id, quantity_ordered, unit_cost_centavos
    )
    values (
      v_org, v_po, (item ->> 'product_id')::uuid,
      greatest((item ->> 'quantity_ordered')::int, 1),
      greatest(coalesce((item ->> 'unit_cost_centavos')::int, 0), 0)
    );
  end loop;

  return v_po;
end;
$$;

-- ---------------------------------------------------------------------------
-- receive_purchase_order — turn received quantities into batches + movements,
-- update quantity_received, and mark the PO received.
-- p_lines: jsonb array of { item_id, quantity_received, batch_number, expiry_date }.
-- ---------------------------------------------------------------------------
create or replace function public.receive_purchase_order(
  p_po uuid,
  p_lines jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  po     public.purchase_orders%rowtype;
  ln     jsonb;
  it     public.purchase_order_items%rowtype;
  v_qty  integer;
  v_exp  date;
  v_bn   text;
  v_batch uuid;
begin
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'You do not have permission to receive stock';
  end if;

  select * into po from public.purchase_orders where id = p_po;
  if not found then
    raise exception 'Purchase order not found';
  end if;
  if po.organization_id <> public.auth_org_id() then
    raise exception 'Purchase order is not in your organization';
  end if;
  if po.status = 'received' or po.status = 'cancelled' then
    raise exception 'This purchase order can no longer be received';
  end if;

  for ln in select * from jsonb_array_elements(p_lines)
  loop
    v_qty := coalesce((ln ->> 'quantity_received')::int, 0);
    if v_qty <= 0 then
      continue;
    end if;

    select * into it from public.purchase_order_items
    where id = (ln ->> 'item_id')::uuid and purchase_order_id = p_po;
    if not found then
      continue;
    end if;

    v_bn := nullif(ln ->> 'batch_number', '');
    v_exp := (nullif(ln ->> 'expiry_date', ''))::date;

    insert into public.batches (
      organization_id, branch_id, product_id, supplier_id,
      batch_number, expiry_date, quantity, cost_centavos
    )
    values (
      po.organization_id, po.branch_id, it.product_id, po.supplier_id,
      v_bn, v_exp, v_qty, it.unit_cost_centavos
    )
    returning id into v_batch;

    insert into public.inventory_movements (
      organization_id, branch_id, product_id, batch_id, type, quantity_delta, reference_id, reason, created_by
    )
    values (
      po.organization_id, po.branch_id, it.product_id, v_batch, 'receive', v_qty, p_po,
      'PO ' || po.po_number, auth.uid()
    );

    update public.purchase_order_items
    set quantity_received = quantity_received + v_qty
    where id = it.id;
  end loop;

  update public.purchase_orders set status = 'received' where id = p_po;
end;
$$;

grant execute on function public.create_purchase_order(uuid, uuid, date, text, jsonb) to authenticated;
grant execute on function public.receive_purchase_order(uuid, jsonb) to authenticated;
