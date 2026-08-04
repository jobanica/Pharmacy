-- ============================================================================
-- Product-level cost, so losses are costed even when a batch has no cost.
--
-- Batches already snapshot their own cost on receive (PO, receipt scan, manual
-- receive, CSV import with a cost column). But stock imported without a cost
-- lands at 0, and there was no fallback — so write-offs showed ₱0.00. This adds
-- a durable cost on the product itself:
--   * products.default_cost_centavos (settable in the product form + on import)
--   * import_products sets/refreshes it from the row's cost
--   * write_off_stock uses the batch cost, falling back to the product cost
--   * backfilled from existing non-zero batch costs
-- ============================================================================

alter table public.products
  add column if not exists default_cost_centavos integer not null default 0
    check (default_cost_centavos >= 0);

-- Backfill: give each product the highest non-zero batch cost seen so far.
update public.products p
set default_cost_centavos = sub.cost
from (
  select product_id, max(cost_centavos) as cost
  from public.batches
  where cost_centavos > 0
  group by product_id
) sub
where sub.product_id = p.id and p.default_cost_centavos = 0;

-- ---------------------------------------------------------------------------
-- import_products: also set/refresh the product's default cost from the row.
-- (Same behavior as before, plus product cost capture.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.import_products(p_branch uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_org       uuid;
  v_row       jsonb;
  v_name      text;
  v_cat_name  text;
  v_cat_id    uuid;
  v_product   uuid;
  v_qty       integer;
  v_cost      integer;
  v_expiry    date;
  v_created   integer := 0;
  v_matched   integer := 0;
  v_skipped   integer := 0;
  v_batches   integer := 0;
  v_errors    text[] := array[]::text[];
  v_idx       integer := 0;
begin
  if not public.has_org_role(array['owner','manager']::public.user_role[]) then
    raise exception 'You do not have permission to import products';
  end if;

  select organization_id into v_org from public.branches where id = p_branch;
  if v_org is null then
    raise exception 'Branch not found';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;
    v_name := trim(coalesce(v_row->>'name', ''));

    if v_name = '' then
      v_skipped := v_skipped + 1;
      if array_length(v_errors, 1) is null or array_length(v_errors, 1) < 50 then
        v_errors := array_append(v_errors, 'Row ' || v_idx || ': missing name');
      end if;
      continue;
    end if;

    v_cost := coalesce((v_row->>'cost_centavos')::integer, 0);

    v_cat_id := null;
    v_cat_name := trim(coalesce(v_row->>'category', ''));
    if v_cat_name <> '' then
      select id into v_cat_id
      from public.categories
      where organization_id = v_org and lower(name) = lower(v_cat_name)
      limit 1;
      if v_cat_id is null then
        insert into public.categories (organization_id, name)
        values (v_org, v_cat_name)
        returning id into v_cat_id;
      end if;
    end if;

    -- Reuse an existing product (don't create a duplicate); else create it.
    select id into v_product
    from public.products
    where organization_id = v_org and lower(name) = lower(v_name)
    order by created_at asc
    limit 1;

    if v_product is null then
      begin
        insert into public.products (
          organization_id, category_id, name, generic_name, sku, barcode,
          unit, requires_prescription, reorder_point, default_price_centavos,
          default_cost_centavos, is_active
        )
        values (
          v_org, v_cat_id, v_name,
          nullif(trim(coalesce(v_row->>'generic_name', '')), ''),
          nullif(trim(coalesce(v_row->>'sku', '')), ''),
          nullif(trim(coalesce(v_row->>'barcode', '')), ''),
          coalesce(nullif(trim(coalesce(v_row->>'unit', '')), ''), 'piece'),
          coalesce((v_row->>'requires_prescription')::boolean, false),
          coalesce((v_row->>'reorder_point')::integer, 0),
          coalesce((v_row->>'price_centavos')::integer, 0),
          v_cost,
          true
        )
        returning id into v_product;
      exception when others then
        v_skipped := v_skipped + 1;
        if array_length(v_errors, 1) is null or array_length(v_errors, 1) < 50 then
          v_errors := array_append(v_errors, 'Row ' || v_idx || ' (' || v_name || '): ' || SQLERRM);
        end if;
        continue;
      end;
      v_created := v_created + 1;
    else
      v_matched := v_matched + 1;
      -- Refresh the product's default cost if this import row carries one.
      if v_cost > 0 then
        update public.products set default_cost_centavos = v_cost
        where id = v_product and default_cost_centavos <> v_cost;
      end if;
    end if;

    -- Opening stock batch for THIS branch.
    v_qty := coalesce((v_row->>'quantity')::integer, 0);
    if v_qty > 0 then
      begin
        v_expiry := (v_row->>'expiry')::date;
      exception when others then
        v_expiry := null;
      end;

      insert into public.batches (
        organization_id, branch_id, product_id, expiry_date, quantity, cost_centavos
      )
      values (v_org, p_branch, v_product, v_expiry, v_qty, v_cost);

      insert into public.inventory_movements (
        organization_id, branch_id, product_id, batch_id, type, quantity_delta, reason, created_by
      )
      select v_org, p_branch, v_product, b.id, 'receive', v_qty, 'Imported opening stock', auth.uid()
      from public.batches b
      where b.branch_id = p_branch and b.product_id = v_product
      order by b.created_at desc
      limit 1;

      v_batches := v_batches + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'created', v_created,
    'matched', v_matched,
    'skipped', v_skipped,
    'batches', v_batches,
    'errors', to_jsonb(v_errors)
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- write_off_stock: batch cost, falling back to the product's default cost.
-- (Also keeps the movement_type enum cast fix.)
-- ---------------------------------------------------------------------------
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
  v_unit    integer;
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

  -- Prefer the batch's own cost; fall back to the product's default cost.
  v_unit := coalesce(v_b.cost_centavos, 0);
  if v_unit = 0 then
    select coalesce(default_cost_centavos, 0) into v_unit
    from public.products where id = v_b.product_id;
    v_unit := coalesce(v_unit, 0);
  end if;
  v_total := p_quantity * v_unit;

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
    p_quantity, v_unit, v_total, v_reason, nullif(p_notes, ''), auth.uid()
  );

  return jsonb_build_object('total_cost_centavos', v_total);
end;
$$;

grant execute on function public.write_off_stock(uuid, integer, text, text) to authenticated;
