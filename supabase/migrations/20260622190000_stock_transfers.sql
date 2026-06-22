-- ============================================================================
-- Milestone 7 — Stock transfers (branch-to-branch).
--
-- Flow: create_transfer (deducts source, status=in_transit) →
--       receive_transfer (adds to dest, status=received).
-- Both ends write inventory_movements of type 'transfer'; direction inferred
-- from quantity_delta sign (negative = out, positive = in).
-- ============================================================================

create type public.transfer_status as enum ('in_transit', 'received', 'cancelled');

create table public.stock_transfers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  from_branch_id  uuid not null references public.branches (id) on delete restrict,
  to_branch_id    uuid not null references public.branches (id) on delete restrict,
  status          public.transfer_status not null default 'in_transit',
  notes           text,
  created_by      uuid references auth.users (id) on delete set null,
  received_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  received_at     timestamptz,
  constraint transfers_different_branches check (from_branch_id <> to_branch_id)
);

create table public.stock_transfer_items (
  id                  uuid primary key default gen_random_uuid(),
  transfer_id         uuid not null references public.stock_transfers (id) on delete cascade,
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  product_id          uuid not null references public.products (id) on delete restrict,
  source_batch_id     uuid references public.batches (id) on delete set null,
  quantity            integer not null,
  unit_cost_centavos  integer not null default 0
);

create index stock_transfers_org_idx    on public.stock_transfers (organization_id, created_at desc);
create index stock_transfers_from_idx   on public.stock_transfers (from_branch_id, status);
create index stock_transfers_to_idx     on public.stock_transfers (to_branch_id, status);
create index stock_transfer_items_t_idx on public.stock_transfer_items (transfer_id);

alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;

create policy "org members view transfers"
  on public.stock_transfers for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers create transfers"
  on public.stock_transfers for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

create policy "managers update transfers"
  on public.stock_transfers for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

create policy "org members view transfer items"
  on public.stock_transfer_items for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers create transfer items"
  on public.stock_transfer_items for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- ============================================================================
-- create_transfer — FEFO-deduct from source branch; mark in_transit.
-- p_items: [{product_id uuid, quantity int}]
-- ============================================================================
create or replace function public.create_transfer(
  p_from_branch  uuid,
  p_to_branch    uuid,
  p_items        jsonb,
  p_notes        text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org        uuid;
  v_plan       text;
  v_track      boolean;
  v_xfer       uuid;
  item         jsonb;
  v_pid        uuid;
  v_qty        integer;
  v_remaining  integer;
  v_take       integer;
  b            record;
begin
  select organization_id into v_org from public.branches where id = p_from_branch;
  if v_org is null then raise exception 'Source branch not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Branch is not in your organization'; end if;

  if not exists (select 1 from public.branches where id = p_to_branch and organization_id = v_org) then
    raise exception 'Destination branch not found in your organization';
  end if;
  if p_from_branch = p_to_branch then
    raise exception 'Source and destination branches must differ';
  end if;
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'Only managers or pharmacists can create transfers';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Transfer must include at least one item';
  end if;

  select plan into v_plan from public.organizations where id = v_org;
  v_track := coalesce(v_plan, 'free') in ('starter', 'pro');

  insert into public.stock_transfers (organization_id, from_branch_id, to_branch_id, notes, created_by)
  values (v_org, p_from_branch, p_to_branch, p_notes, auth.uid())
  returning id into v_xfer;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then continue; end if;

    if not v_track then
      insert into public.stock_transfer_items (transfer_id, organization_id, product_id, quantity)
      values (v_xfer, v_org, v_pid, v_qty);

      insert into public.inventory_movements (
        organization_id, branch_id, product_id, batch_id, type,
        quantity_delta, reference_id, reason, created_by
      ) values (v_org, p_from_branch, v_pid, null, 'transfer', -v_qty, v_xfer, 'Transfer out', auth.uid());
    else
      v_remaining := v_qty;
      for b in
        select id, quantity, cost_centavos
        from public.batches
        where branch_id = p_from_branch and product_id = v_pid and quantity > 0
          and (expiry_date is null or expiry_date >= (timezone('Asia/Manila', now()))::date)
        order by expiry_date asc nulls last, received_at asc
        for update
      loop
        exit when v_remaining <= 0;
        v_take := least(v_remaining, b.quantity);
        update public.batches set quantity = quantity - v_take where id = b.id;

        insert into public.stock_transfer_items (transfer_id, organization_id, product_id, source_batch_id, quantity, unit_cost_centavos)
        values (v_xfer, v_org, v_pid, b.id, v_take, b.cost_centavos);

        insert into public.inventory_movements (
          organization_id, branch_id, product_id, batch_id, type,
          quantity_delta, reference_id, reason, created_by
        ) values (v_org, p_from_branch, v_pid, b.id, 'transfer', -v_take, v_xfer, 'Transfer out', auth.uid());

        v_remaining := v_remaining - v_take;
      end loop;
      if v_remaining > 0 then
        raise exception 'Insufficient stock for product % at source branch', v_pid;
      end if;
    end if;
  end loop;

  return v_xfer;
end;
$$;

grant execute on function public.create_transfer(uuid, uuid, jsonb, text) to authenticated;

-- ============================================================================
-- receive_transfer — add stock to destination branch; mark received.
-- ============================================================================
create or replace function public.receive_transfer(
  p_transfer  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org        uuid;
  v_to_branch  uuid;
  v_status     public.transfer_status;
  v_plan       text;
  v_track      boolean;
  v_batch      uuid;
  item         record;
begin
  select organization_id, to_branch_id, status
  into v_org, v_to_branch, v_status
  from public.stock_transfers
  where id = p_transfer;

  if v_org is null then raise exception 'Transfer not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Transfer is not in your organization'; end if;
  if v_status <> 'in_transit' then
    raise exception 'Transfer is not in transit (current status: %)', v_status;
  end if;
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'Only managers or pharmacists can receive transfers';
  end if;

  select plan into v_plan from public.organizations where id = v_org;
  v_track := coalesce(v_plan, 'free') in ('starter', 'pro');

  for item in
    select product_id, source_batch_id, quantity, unit_cost_centavos
    from public.stock_transfer_items
    where transfer_id = p_transfer
  loop
    if v_track then
      -- Find an existing un-numbered batch with matching cost at destination.
      select id into v_batch
      from public.batches
      where branch_id = v_to_branch
        and product_id = item.product_id
        and cost_centavos = item.unit_cost_centavos
        and batch_number is null
      order by received_at desc
      limit 1;

      if v_batch is null then
        insert into public.batches (
          organization_id, branch_id, product_id,
          quantity, cost_centavos, received_at
        )
        values (v_org, v_to_branch, item.product_id,
                item.quantity, item.unit_cost_centavos, now())
        returning id into v_batch;
      else
        update public.batches set quantity = quantity + item.quantity where id = v_batch;
      end if;

      insert into public.inventory_movements (
        organization_id, branch_id, product_id, batch_id, type,
        quantity_delta, reference_id, reason, created_by
      ) values (v_org, v_to_branch, item.product_id, v_batch, 'transfer',
                item.quantity, p_transfer, 'Transfer in', auth.uid());
    else
      insert into public.inventory_movements (
        organization_id, branch_id, product_id, batch_id, type,
        quantity_delta, reference_id, reason, created_by
      ) values (v_org, v_to_branch, item.product_id, null, 'transfer',
                item.quantity, p_transfer, 'Transfer in', auth.uid());
    end if;
  end loop;

  update public.stock_transfers
  set status = 'received', received_by = auth.uid(), received_at = now()
  where id = p_transfer;
end;
$$;

grant execute on function public.receive_transfer(uuid) to authenticated;
