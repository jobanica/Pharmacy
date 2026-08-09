-- ============================================================================
-- Fix: creating a PO failed with "duplicate key ... purchase_orders_
-- organization_id_po_number_key" after a PO was deleted.
--
-- PO numbers were generated as count(*) + 1. Once any PO is deleted the count
-- drops below the highest existing number, so the next PO regenerates a number
-- that already exists → unique-constraint violation. Generate from the MAX
-- existing numeric suffix instead, which is stable across deletes and gaps.
-- (The `for update` lock on the org row still serializes concurrent creates.)
-- ============================================================================
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
  select 'PO-' || lpad(
    (coalesce(max(nullif(regexp_replace(po_number, '\D', '', 'g'), '')::int), 0) + 1)::text,
    5, '0')
  into v_number
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
