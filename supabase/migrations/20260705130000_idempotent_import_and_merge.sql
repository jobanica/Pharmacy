-- 1) Make CSV import idempotent: skip rows whose product name already exists
--    (case-insensitive) in the org, so re-importing the same file can't create
--    duplicate product records.
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

    -- Skip products that already exist (idempotent re-import).
    if exists (
      select 1 from public.products
      where organization_id = v_org and lower(name) = lower(v_name)
    ) then
      v_skipped := v_skipped + 1;
      if array_length(v_errors, 1) is null or array_length(v_errors, 1) < 50 then
        v_errors := array_append(v_errors, 'Row ' || v_idx || ' (' || v_name || '): already exists — skipped');
      end if;
      continue;
    end if;

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

    begin
      insert into public.products (
        organization_id, category_id, name, generic_name, sku, barcode,
        unit, requires_prescription, reorder_point, default_price_centavos, is_active
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

    v_qty := coalesce((v_row->>'quantity')::integer, 0);
    if v_qty > 0 then
      v_cost := coalesce((v_row->>'cost_centavos')::integer, 0);
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
    'skipped', v_skipped,
    'batches', v_batches,
    'errors', to_jsonb(v_errors)
  );
end;
$function$;

-- 2) Merge duplicate products (same name) into the oldest record, repointing all
--    references, then deleting the duplicates. Owner/manager only. Returns count.
CREATE OR REPLACE FUNCTION public.merge_duplicate_products()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org    uuid := public.auth_org_id();
  v_merged integer := 0;
  r        record;
  v_canon  uuid;
  d        record;
begin
  if not public.has_org_role(array['owner','manager']::public.user_role[]) then
    raise exception 'Only an owner or manager can merge duplicates';
  end if;

  for r in
    select lower(trim(name)) as key
    from public.products
    where organization_id = v_org
    group by lower(trim(name))
    having count(*) > 1
  loop
    select id into v_canon
    from public.products
    where organization_id = v_org and lower(trim(name)) = r.key
    order by created_at asc, id asc
    limit 1;

    for d in
      select id from public.products
      where organization_id = v_org and lower(trim(name)) = r.key and id <> v_canon
    loop
      update public.batches            set product_id = v_canon where product_id = d.id;
      update public.inventory_movements set product_id = v_canon where product_id = d.id;
      update public.sale_items          set product_id = v_canon where product_id = d.id;
      update public.purchase_order_items set product_id = v_canon where product_id = d.id;
      update public.order_items         set product_id = v_canon where product_id = d.id;
      update public.sale_return_items   set product_id = v_canon where product_id = d.id;
      update public.stock_transfer_items set product_id = v_canon where product_id = d.id;
      -- stocktake_items has a unique(stocktake_id, product_id); drop the dup rows.
      delete from public.stocktake_items where product_id = d.id;

      delete from public.products where id = d.id;
      v_merged := v_merged + 1;
    end loop;
  end loop;

  return jsonb_build_object('merged', v_merged);
end;
$function$;

grant execute on function public.merge_duplicate_products() to authenticated;
