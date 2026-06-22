-- ============================================================================
-- receive_po_item — receive ONE purchase-order line into inventory.
--   Creates a batch (with batch number + expiry), logs the movement, and bumps
--   quantity_received. Unlike receive_purchase_order (which marks the whole PO
--   received in one shot), this lets the owner add items one by one — e.g. while
--   checking a scanned supplier receipt line by line. The PO flips to 'received'
--   only once every line is fully received.
-- ============================================================================
create or replace function public.receive_po_item(
  p_item uuid,
  p_quantity integer,
  p_batch_number text default null,
  p_expiry date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  it           public.purchase_order_items%rowtype;
  po           public.purchase_orders%rowtype;
  v_batch      uuid;
  v_outstanding integer;
begin
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'You do not have permission to receive stock';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Received quantity must be greater than zero';
  end if;

  select * into it from public.purchase_order_items where id = p_item;
  if not found then raise exception 'Purchase order item not found'; end if;

  select * into po from public.purchase_orders where id = it.purchase_order_id for update;
  if po.organization_id <> public.auth_org_id() then
    raise exception 'Purchase order is not in your organization';
  end if;
  if po.status = 'received' or po.status = 'cancelled' then
    raise exception 'This purchase order can no longer be received';
  end if;

  insert into public.batches (
    organization_id, branch_id, product_id, supplier_id,
    batch_number, expiry_date, quantity, cost_centavos
  )
  values (
    po.organization_id, po.branch_id, it.product_id, po.supplier_id,
    nullif(p_batch_number, ''), p_expiry, p_quantity, it.unit_cost_centavos
  )
  returning id into v_batch;

  insert into public.inventory_movements (
    organization_id, branch_id, product_id, batch_id, type, quantity_delta, reference_id, reason, created_by
  )
  values (
    po.organization_id, po.branch_id, it.product_id, v_batch, 'receive', p_quantity, po.id,
    'PO ' || po.po_number, auth.uid()
  );

  update public.purchase_order_items
  set quantity_received = quantity_received + p_quantity
  where id = it.id;

  -- Mark the PO received once nothing is outstanding; otherwise keep it 'sent'.
  select coalesce(sum(greatest(quantity_ordered - quantity_received, 0)), 0)
    into v_outstanding
    from public.purchase_order_items where purchase_order_id = po.id;
  if v_outstanding <= 0 then
    update public.purchase_orders set status = 'received' where id = po.id;
  elsif po.status = 'draft' then
    update public.purchase_orders set status = 'sent' where id = po.id;
  end if;
end;
$$;

grant execute on function public.receive_po_item(uuid, integer, text, date) to authenticated;
