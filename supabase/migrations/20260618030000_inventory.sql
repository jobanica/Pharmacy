-- ============================================================================
-- Milestone 4 — Inventory core: batches, movements (audit log), on-hand view,
-- and atomic stock operations (receive, adjust, FEFO deduct).
--
-- Invariant: every change to a batch quantity writes an immutable
-- inventory_movements row. Mutations go through SECURITY INVOKER functions so
-- RLS still enforces tenant isolation + role checks, while keeping the batch
-- update and its movement row in a single transaction.
-- ============================================================================

create type public.movement_type as enum (
  'receive', 'sale', 'adjustment', 'void', 'transfer', 'expiry_writeoff'
);

-- ---------------------------------------------------------------------------
-- batches — a stock lot of a product at a branch
-- ---------------------------------------------------------------------------
create table public.batches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id       uuid not null references public.branches (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  supplier_id     uuid references public.suppliers (id) on delete set null,
  batch_number    text,
  expiry_date     date,
  quantity        integer not null default 0 check (quantity >= 0),
  cost_centavos   integer not null default 0 check (cost_centavos >= 0),
  received_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index batches_organization_id_idx on public.batches (organization_id);
create index batches_branch_product_idx on public.batches (branch_id, product_id);
create index batches_product_idx on public.batches (product_id);
create index batches_expiry_idx on public.batches (expiry_date);

-- ---------------------------------------------------------------------------
-- inventory_movements — append-only audit log of every quantity change
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id       uuid not null references public.branches (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  batch_id        uuid references public.batches (id) on delete set null,
  type            public.movement_type not null,
  quantity_delta  integer not null,
  reference_id    uuid,
  reason          text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index inventory_movements_org_idx on public.inventory_movements (organization_id);
create index inventory_movements_product_branch_idx
  on public.inventory_movements (product_id, branch_id);
create index inventory_movements_batch_idx on public.inventory_movements (batch_id);
create index inventory_movements_created_at_idx on public.inventory_movements (created_at desc);

-- ---------------------------------------------------------------------------
-- On-hand view: sum of non-expired, non-zero batch quantities per product/branch
-- (Section 4). security_invoker so RLS on batches applies to the caller.
-- ---------------------------------------------------------------------------
create view public.v_product_on_hand
with (security_invoker = on) as
  select
    organization_id,
    branch_id,
    product_id,
    sum(quantity)::int as on_hand
  from public.batches
  where quantity > 0
    and (expiry_date is null or expiry_date >= (timezone('Asia/Manila', now()))::date)
  group by organization_id, branch_id, product_id;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.batches enable row level security;
alter table public.inventory_movements enable row level security;

-- batches: all members read; manage_stock (owner/manager/pharmacist) write.
create policy "org members view batches"
  on public.batches for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "stock managers write batches"
  on public.batches for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- movements: all members read; insert by stock managers OR cashier (sales in M5
-- write movements too). NO update/delete policies -> the log is append-only.
create policy "org members view movements"
  on public.inventory_movements for select to authenticated
  using (organization_id = public.auth_org_id());
create policy "members insert movements"
  on public.inventory_movements for insert to authenticated
  with check (organization_id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- receive_stock — create/extend a batch and log a 'receive' movement
-- ---------------------------------------------------------------------------
create or replace function public.receive_stock(
  p_branch uuid,
  p_product uuid,
  p_quantity integer,
  p_cost_centavos integer,
  p_supplier uuid default null,
  p_batch_number text default null,
  p_expiry date default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org   uuid;
  v_batch uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number';
  end if;
  if p_cost_centavos is null or p_cost_centavos < 0 then
    raise exception 'Cost must be zero or more';
  end if;

  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then
    raise exception 'Branch not found';
  end if;

  -- Merge into an identical existing lot (same number/expiry/cost), else create.
  select id into v_batch
  from public.batches
  where branch_id = p_branch
    and product_id = p_product
    and coalesce(batch_number, '') = coalesce(nullif(p_batch_number, ''), '')
    and expiry_date is not distinct from p_expiry
    and cost_centavos = p_cost_centavos
  limit 1;

  if v_batch is null then
    insert into public.batches (
      organization_id, branch_id, product_id, supplier_id,
      batch_number, expiry_date, quantity, cost_centavos
    )
    values (
      v_org, p_branch, p_product, p_supplier,
      nullif(p_batch_number, ''), p_expiry, p_quantity, p_cost_centavos
    )
    returning id into v_batch;
  else
    update public.batches set quantity = quantity + p_quantity where id = v_batch;
  end if;

  insert into public.inventory_movements (
    organization_id, branch_id, product_id, batch_id, type, quantity_delta, reason, created_by
  )
  values (v_org, p_branch, p_product, v_batch, 'receive', p_quantity, 'Stock received', auth.uid());

  return v_batch;
end;
$$;

-- ---------------------------------------------------------------------------
-- adjust_batch — set a batch's quantity to an absolute value, log the delta
-- ---------------------------------------------------------------------------
create or replace function public.adjust_batch(
  p_batch uuid,
  p_new_quantity integer,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  b      public.batches%rowtype;
  v_delta integer;
begin
  if p_new_quantity is null or p_new_quantity < 0 then
    raise exception 'New quantity must be zero or more';
  end if;

  select * into b from public.batches where id = p_batch;
  if not found then
    raise exception 'Batch not found';
  end if;

  v_delta := p_new_quantity - b.quantity;
  if v_delta = 0 then
    return;
  end if;

  update public.batches set quantity = p_new_quantity where id = p_batch;

  insert into public.inventory_movements (
    organization_id, branch_id, product_id, batch_id, type, quantity_delta, reason, created_by
  )
  values (
    b.organization_id, b.branch_id, b.product_id, b.id, 'adjustment', v_delta,
    coalesce(nullif(p_reason, ''), 'Manual adjustment'), auth.uid()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- fefo_deduct — remove p_quantity of a product at a branch, First-Expiry-First
-- -Out, logging one movement per affected batch. Used by sales (M5), write-offs
-- (M6), and transfers. Raises if there isn't enough non-expired stock.
-- ---------------------------------------------------------------------------
create or replace function public.fefo_deduct(
  p_branch uuid,
  p_product uuid,
  p_quantity integer,
  p_type public.movement_type,
  p_reference uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_remaining integer := p_quantity;
  v_take      integer;
  r           record;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be a positive number';
  end if;

  for r in
    select id, quantity, organization_id, branch_id, product_id
    from public.batches
    where branch_id = p_branch
      and product_id = p_product
      and quantity > 0
      and (expiry_date is null or expiry_date >= (timezone('Asia/Manila', now()))::date)
    order by expiry_date asc nulls last, received_at asc
    for update
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, r.quantity);

    update public.batches set quantity = quantity - v_take where id = r.id;

    insert into public.inventory_movements (
      organization_id, branch_id, product_id, batch_id, type, quantity_delta, reference_id, reason, created_by
    )
    values (
      r.organization_id, r.branch_id, r.product_id, r.id, p_type, -v_take, p_reference, p_reason, auth.uid()
    );

    v_remaining := v_remaining - v_take;
  end loop;

  if v_remaining > 0 then
    raise exception 'Insufficient stock: short by % unit(s)', v_remaining;
  end if;
end;
$$;

grant execute on function public.receive_stock(uuid, uuid, integer, integer, uuid, text, date) to authenticated;
grant execute on function public.adjust_batch(uuid, integer, text) to authenticated;
grant execute on function public.fefo_deduct(uuid, uuid, integer, public.movement_type, uuid, text) to authenticated;
