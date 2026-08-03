-- ---------------------------------------------------------------------------
-- Dead stock, slow-moving inventory, and stock write-offs (expired / damaged).
-- ---------------------------------------------------------------------------

-- Sales velocity per product+branch: last completed sale and units sold in 90d.
create or replace view public.v_product_sales_velocity
with (security_invoker = on) as
  select
    s.branch_id,
    si.product_id,
    max(s.created_at) as last_sold_at,
    coalesce(sum(si.quantity) filter (where s.created_at >= now() - interval '90 days'), 0) as sold_90d
  from public.sale_items si
  join public.sales s on s.id = si.sale_id and s.status = 'completed'
  group by s.branch_id, si.product_id;

-- Dead stock: has sellable stock but no sale in the last 90 days.
create or replace view public.v_dead_stock
with (security_invoker = on) as
  select
    oh.organization_id,
    oh.branch_id,
    oh.product_id,
    p.name as product_name,
    p.unit,
    oh.on_hand,
    coalesce(bc.unit_cost_centavos, 0) as unit_cost_centavos,
    oh.on_hand * coalesce(bc.unit_cost_centavos, 0) as value_centavos,
    v.last_sold_at
  from public.v_product_on_hand oh
  join public.products p on p.id = oh.product_id
  left join public.v_product_sales_velocity v
    on v.branch_id = oh.branch_id and v.product_id = oh.product_id
  left join lateral (
    select max(b.cost_centavos) as unit_cost_centavos
    from public.batches b
    where b.product_id = oh.product_id and b.branch_id = oh.branch_id and b.quantity > 0
  ) bc on true
  where oh.on_hand > 0
    and (v.last_sold_at is null or v.last_sold_at < now() - interval '90 days');

-- Slow-moving: sold within 90 days but with >120 days of supply at current rate.
create or replace view public.v_slow_moving
with (security_invoker = on) as
  select
    oh.organization_id,
    oh.branch_id,
    oh.product_id,
    p.name as product_name,
    p.unit,
    oh.on_hand,
    v.sold_90d,
    round((oh.on_hand::numeric / (v.sold_90d::numeric / 90))) as days_of_supply,
    coalesce(bc.unit_cost_centavos, 0) as unit_cost_centavos,
    oh.on_hand * coalesce(bc.unit_cost_centavos, 0) as value_centavos,
    v.last_sold_at
  from public.v_product_on_hand oh
  join public.products p on p.id = oh.product_id
  join public.v_product_sales_velocity v
    on v.branch_id = oh.branch_id and v.product_id = oh.product_id
  left join lateral (
    select max(b.cost_centavos) as unit_cost_centavos
    from public.batches b
    where b.product_id = oh.product_id and b.branch_id = oh.branch_id and b.quantity > 0
  ) bc on true
  where oh.on_hand > 0
    and v.last_sold_at >= now() - interval '90 days'
    and v.sold_90d > 0
    and (oh.on_hand::numeric / (v.sold_90d::numeric / 90)) > 120;

-- ---------------------------------------------------------------------------
-- Stock write-offs (expired / damaged / other) with cost captured at write-off.
-- ---------------------------------------------------------------------------
create table if not exists public.stock_writeoffs (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  branch_id           uuid references public.branches(id) on delete set null,
  product_id          uuid references public.products(id) on delete set null,
  batch_id            uuid references public.batches(id) on delete set null,
  product_name        text,
  quantity            integer not null,
  unit_cost_centavos  integer not null default 0,
  total_cost_centavos integer not null default 0,
  reason              text not null default 'other',
  notes               text,
  created_by          uuid,
  created_at          timestamptz not null default now()
);

create index if not exists stock_writeoffs_org_idx
  on public.stock_writeoffs (organization_id, branch_id, created_at desc);

alter table public.stock_writeoffs enable row level security;

create policy "org members view writeoffs"
  on public.stock_writeoffs for select
  using (organization_id = public.auth_org_id());

create policy "stock managers insert writeoffs"
  on public.stock_writeoffs for insert
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  );

-- Write off stock from a batch (reduces on-hand, logs a movement + a write-off).
create or replace function public.write_off_stock(
  p_batch uuid,
  p_quantity integer,
  p_reason text default 'other',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_b       public.batches%rowtype;
  v_name    text;
  v_reason  text;
  v_total   integer;
begin
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'You do not have permission to adjust stock';
  end if;

  select * into v_b from public.batches where id = p_batch;
  if not found then raise exception 'Batch not found'; end if;
  if v_b.organization_id <> public.auth_org_id() then
    raise exception 'Batch is not in your organization';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if p_quantity > v_b.quantity then
    raise exception 'Cannot write off more than on hand (% available)', v_b.quantity;
  end if;

  v_reason := lower(coalesce(p_reason, 'other'));
  if v_reason not in ('expired', 'damaged', 'other') then v_reason := 'other'; end if;
  v_total := p_quantity * v_b.cost_centavos;
  select name into v_name from public.products where id = v_b.product_id;

  update public.batches set quantity = quantity - p_quantity where id = p_batch;

  insert into public.inventory_movements (
    organization_id, branch_id, product_id, batch_id, type, quantity_delta, reason, created_by
  ) values (
    v_b.organization_id, v_b.branch_id, v_b.product_id, v_b.id,
    (case when v_reason = 'expired' then 'expiry_writeoff' else 'adjustment' end)::public.movement_type,
    -p_quantity, 'Write-off (' || v_reason || ')' || coalesce(': ' || nullif(p_notes, ''), ''),
    auth.uid()
  );

  insert into public.stock_writeoffs (
    organization_id, branch_id, product_id, batch_id, product_name,
    quantity, unit_cost_centavos, total_cost_centavos, reason, notes, created_by
  ) values (
    v_b.organization_id, v_b.branch_id, v_b.product_id, v_b.id, v_name,
    p_quantity, v_b.cost_centavos, v_total, v_reason, nullif(p_notes, ''), auth.uid()
  );

  return jsonb_build_object('total_cost_centavos', v_total);
end;
$$;

grant execute on function public.write_off_stock(uuid, integer, text, text) to authenticated;
