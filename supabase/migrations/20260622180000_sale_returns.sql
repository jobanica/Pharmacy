-- ============================================================================
-- Milestone 6 — Sale returns.
--
-- Returns reference an original completed sale. Items are validated against
-- the original sale_items; already-returned quantities are tracked so the
-- same item can't be double-returned.  Stock is restored to the newest batch
-- for tracked plans.  Return numbers share the OR sequence (BIR requires
-- credit memos to carry sequential document numbers) but are prefixed "RET-".
-- ============================================================================

create table public.sale_returns (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  branch_id           uuid not null references public.branches (id) on delete cascade,
  original_sale_id    uuid not null references public.sales (id) on delete restrict,
  return_number       text not null,
  cashier_id          uuid references auth.users (id) on delete set null,
  reason              text,
  total_centavos      integer not null default 0,
  created_at          timestamptz not null default now()
);

create table public.sale_return_items (
  id                    uuid primary key default gen_random_uuid(),
  return_id             uuid not null references public.sale_returns (id) on delete cascade,
  organization_id       uuid not null references public.organizations (id) on delete cascade,
  product_id            uuid not null references public.products (id) on delete restrict,
  quantity              integer not null,
  unit_price_centavos   integer not null,
  line_total_centavos   integer not null
);

create index sale_returns_org_idx      on public.sale_returns (organization_id, created_at desc);
create index sale_returns_sale_idx     on public.sale_returns (original_sale_id);
create index sale_return_items_ret_idx on public.sale_return_items (return_id);

alter table public.sale_returns enable row level security;
alter table public.sale_return_items enable row level security;

create policy "org members view returns"
  on public.sale_returns for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers create returns"
  on public.sale_returns for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

create policy "org members view return items"
  on public.sale_return_items for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers create return items"
  on public.sale_return_items for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- ============================================================================
-- process_return(p_sale, p_items, p_reason)
--
-- p_items: [{product_id uuid, quantity int}]
-- Returns the new sale_return uuid.
-- ============================================================================
create or replace function public.process_return(
  p_sale    uuid,
  p_items   jsonb,
  p_reason  text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org           uuid;
  v_branch        uuid;
  v_plan          text;
  v_track         boolean;
  v_ret           uuid;
  v_ret_number    text;
  v_next          bigint;
  v_pad           integer;
  v_total         integer := 0;
  v_pid           uuid;
  v_qty           integer;
  v_max_qty       integer;
  v_price         integer;
  v_already       integer;
  item            jsonb;
begin
  -- Validate sale ownership.
  select organization_id, branch_id
  into v_org, v_branch
  from public.sales
  where id = p_sale and status = 'completed';

  if v_org is null then raise exception 'Sale not found or not completed'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Sale is not in your organization'; end if;
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'Only managers or pharmacists can process returns';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'No items specified for return';
  end if;

  -- Check this sale hasn't already been fully returned.
  if exists (
    select 1 from public.sale_returns where original_sale_id = p_sale
  ) then
    -- Allow partial returns; just validate quantities below.
    null;
  end if;

  select plan into v_plan from public.organizations where id = v_org;
  v_track := coalesce(v_plan, 'free') in ('starter', 'pro');

  -- Generate return number from the same OR sequence.
  update public.or_sequences
  set last_number = last_number + 1
  where organization_id = v_org
  returning last_number into v_next;

  select coalesce((settings #>> '{tax,or_padding}')::integer, 7)
  into v_pad
  from public.organizations where id = v_org;
  if v_pad is null or v_pad < 1 then v_pad := 7; end if;

  v_ret_number := 'RET-' || lpad(v_next::text, v_pad, '0');

  insert into public.sale_returns (organization_id, branch_id, original_sale_id, return_number, cashier_id, reason)
  values (v_org, v_branch, p_sale, v_ret_number, auth.uid(), p_reason)
  returning id into v_ret;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_pid := (item ->> 'product_id')::uuid;
    v_qty := (item ->> 'quantity')::integer;
    if v_qty is null or v_qty <= 0 then continue; end if;

    -- Look up original quantity and price from sale_items.
    select sum(si.quantity), max(si.unit_price_centavos)
    into v_max_qty, v_price
    from public.sale_items si
    where si.sale_id = p_sale and si.product_id = v_pid;

    if v_max_qty is null then
      raise exception 'Product % was not in the original sale', v_pid;
    end if;

    -- Sum already-returned quantities across prior returns for this sale + product.
    select coalesce(sum(sri.quantity), 0)
    into v_already
    from public.sale_return_items sri
    join public.sale_returns sr on sr.id = sri.return_id
    where sr.original_sale_id = p_sale and sri.product_id = v_pid;

    if v_already + v_qty > v_max_qty then
      raise exception 'Return quantity (%) exceeds remaining returnable quantity (%) for product %',
        v_qty, v_max_qty - v_already, v_pid;
    end if;

    insert into public.sale_return_items (return_id, organization_id, product_id, quantity, unit_price_centavos, line_total_centavos)
    values (v_ret, v_org, v_pid, v_qty, v_price, v_price * v_qty);

    v_total := v_total + v_price * v_qty;

    -- Restore stock for tracked plans.
    if v_track then
      insert into public.inventory_movements (
        organization_id, branch_id, product_id, batch_id, type,
        quantity_delta, reference_id, reason, created_by
      )
      values (v_org, v_branch, v_pid, null, 'return', v_qty, v_ret, 'Return ' || v_ret_number, auth.uid());

      -- Add stock back to the newest batch of this product at this branch.
      update public.batches
      set quantity = quantity + v_qty
      where id = (
        select id from public.batches
        where branch_id = v_branch and product_id = v_pid
        order by received_at desc
        limit 1
      );
    end if;
  end loop;

  update public.sale_returns set total_centavos = v_total where id = v_ret;

  return v_ret;
end;
$$;

grant execute on function public.process_return(uuid, jsonb, text) to authenticated;
