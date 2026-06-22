-- ============================================================================
-- Milestone 8 — Stocktake (physical inventory count).
--
-- Flow: create_stocktake (snapshots system qty) → staff enter counted_qty →
--       approve_stocktake (writes adjustments, updates batches).
-- ============================================================================

create type public.stocktake_status as enum ('draft', 'approved');

create table public.stocktakes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id       uuid not null references public.branches (id) on delete cascade,
  status          public.stocktake_status not null default 'draft',
  notes           text,
  created_by      uuid references auth.users (id) on delete set null,
  approved_by     uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  approved_at     timestamptz
);

create table public.stocktake_items (
  id                  uuid primary key default gen_random_uuid(),
  stocktake_id        uuid not null references public.stocktakes (id) on delete cascade,
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  product_id          uuid not null references public.products (id) on delete restrict,
  system_qty          integer not null default 0,  -- snapshot at count time
  counted_qty         integer,                     -- null = not yet counted
  unit_cost_centavos  integer not null default 0
);

create index stocktakes_org_idx       on public.stocktakes (organization_id, created_at desc);
create index stocktakes_branch_idx    on public.stocktakes (branch_id, status);
create index stocktake_items_st_idx   on public.stocktake_items (stocktake_id);

alter table public.stocktakes enable row level security;
alter table public.stocktake_items enable row level security;

create policy "org members view stocktakes"
  on public.stocktakes for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers create stocktakes"
  on public.stocktakes for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

create policy "managers update stocktakes"
  on public.stocktakes for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

create policy "org members view stocktake items"
  on public.stocktake_items for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "org members update stocktake items"
  on public.stocktake_items for update to authenticated
  using (organization_id = public.auth_org_id());

create policy "managers insert stocktake items"
  on public.stocktake_items for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- ============================================================================
-- create_stocktake — snapshot current on-hand quantities into draft.
-- ============================================================================
create or replace function public.create_stocktake(
  p_branch  uuid,
  p_notes   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org  uuid;
  v_st   uuid;
  v_plan text;
  v_track boolean;
  r      record;
begin
  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then raise exception 'Branch not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Branch is not in your organization'; end if;
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'Only managers or pharmacists can create stocktakes';
  end if;

  select plan into v_plan from public.organizations where id = v_org;
  v_track := coalesce(v_plan, 'free') in ('starter', 'pro');

  insert into public.stocktakes (organization_id, branch_id, notes, created_by)
  values (v_org, p_branch, p_notes, auth.uid())
  returning id into v_st;

  if v_track then
    -- Snapshot from batches: aggregate per product.
    for r in
      select
        p.id                                           as product_id,
        coalesce(sum(b.quantity), 0)::integer          as system_qty,
        coalesce(max(b.cost_centavos), 0)::integer     as unit_cost
      from public.products p
      left join public.batches b
        on b.product_id = p.id
        and b.branch_id = p_branch
        and (b.expiry_date is null or b.expiry_date >= (timezone('Asia/Manila', now()))::date)
      where p.organization_id = v_org and p.is_active = true
      group by p.id
    loop
      insert into public.stocktake_items (stocktake_id, organization_id, product_id, system_qty, unit_cost_centavos)
      values (v_st, v_org, r.product_id, r.system_qty, r.unit_cost);
    end loop;
  else
    -- Free plan: snapshot from v_product_on_hand.
    for r in
      select p.id as product_id, coalesce(h.on_hand, 0)::integer as system_qty
      from public.products p
      left join public.v_product_on_hand h on h.product_id = p.id and h.branch_id = p_branch
      where p.organization_id = v_org and p.is_active = true
    loop
      insert into public.stocktake_items (stocktake_id, organization_id, product_id, system_qty)
      values (v_st, v_org, r.product_id, r.system_qty);
    end loop;
  end if;

  return v_st;
end;
$$;

grant execute on function public.create_stocktake(uuid, text) to authenticated;

-- ============================================================================
-- approve_stocktake — apply counted_qty as the new truth; write adjustments.
-- Only items where counted_qty IS NOT NULL and <> system_qty get movements.
-- ============================================================================
create or replace function public.approve_stocktake(
  p_stocktake  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org     uuid;
  v_branch  uuid;
  v_status  public.stocktake_status;
  v_plan    text;
  v_track   boolean;
  item      record;
  v_delta   integer;
  v_batch   uuid;
begin
  select organization_id, branch_id, status
  into v_org, v_branch, v_status
  from public.stocktakes
  where id = p_stocktake;

  if v_org is null then raise exception 'Stocktake not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Stocktake is not in your organization'; end if;
  if v_status <> 'draft' then raise exception 'Stocktake is already approved'; end if;
  if not public.has_org_role(array['owner','manager']::public.user_role[]) then
    raise exception 'Only owners or managers can approve stocktakes';
  end if;

  select plan into v_plan from public.organizations where id = v_org;
  v_track := coalesce(v_plan, 'free') in ('starter', 'pro');

  for item in
    select product_id, system_qty, counted_qty, unit_cost_centavos
    from public.stocktake_items
    where stocktake_id = p_stocktake and counted_qty is not null
  loop
    v_delta := item.counted_qty - item.system_qty;
    if v_delta = 0 then continue; end if;

    insert into public.inventory_movements (
      organization_id, branch_id, product_id, batch_id, type,
      quantity_delta, reference_id, reason, created_by
    ) values (v_org, v_branch, item.product_id, null, 'adjustment',
              v_delta, p_stocktake, 'Stocktake adjustment', auth.uid());

    if v_track then
      -- Apply delta to the newest batch; if adding and no batch exists, create one.
      select id into v_batch
      from public.batches
      where branch_id = v_branch and product_id = item.product_id
      order by received_at desc
      limit 1;

      if v_batch is not null then
        update public.batches
        set quantity = greatest(quantity + v_delta, 0)
        where id = v_batch;
      elsif v_delta > 0 then
        insert into public.batches (
          organization_id, branch_id, product_id,
          quantity, cost_centavos, received_at
        )
        values (v_org, v_branch, item.product_id,
                v_delta, item.unit_cost_centavos, now());
      end if;
    end if;
  end loop;

  update public.stocktakes
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_stocktake;
end;
$$;

grant execute on function public.approve_stocktake(uuid) to authenticated;
