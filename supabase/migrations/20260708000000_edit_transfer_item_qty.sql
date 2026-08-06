-- ============================================================================
-- Edit an in-transit transfer line's quantity.
-- Increasing pulls the extra units from the line's source batch (must have
-- stock); decreasing returns the difference to that batch. Both log a source-
-- branch stock movement. Setting the quantity to 0 removes the line.
-- Only allowed while the transfer is still in_transit.
-- ============================================================================
create or replace function public.update_transfer_item_qty(
  p_item    uuid,
  p_new_qty integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item  public.stock_transfer_items%rowtype;
  v_tr    public.stock_transfers%rowtype;
  v_delta integer;
  v_avail integer;
begin
  select * into v_item from public.stock_transfer_items where id = p_item;
  if not found then raise exception 'Transfer line not found'; end if;

  select * into v_tr from public.stock_transfers where id = v_item.transfer_id;
  if v_tr.organization_id <> public.auth_org_id() then
    raise exception 'Transfer is not in your organization';
  end if;
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'You do not have permission to edit transfers';
  end if;
  if v_tr.status <> 'in_transit' then
    raise exception 'Only in-transit transfers can be edited';
  end if;
  if p_new_qty is null or p_new_qty < 0 then raise exception 'Invalid quantity'; end if;

  v_delta := p_new_qty - v_item.quantity;
  if v_delta = 0 then return; end if;

  -- No source batch (untracked stock): just adjust the recorded quantity.
  if v_item.source_batch_id is null then
    if p_new_qty = 0 then delete from public.stock_transfer_items where id = p_item;
    else update public.stock_transfer_items set quantity = p_new_qty where id = p_item; end if;
    return;
  end if;

  if v_delta > 0 then
    select quantity into v_avail from public.batches where id = v_item.source_batch_id for update;
    if v_avail is null then raise exception 'The source batch no longer exists'; end if;
    if v_avail < v_delta then
      raise exception 'Only % more unit(s) available in that batch', v_avail;
    end if;
    update public.batches set quantity = quantity - v_delta where id = v_item.source_batch_id;
  else
    update public.batches set quantity = quantity + (-v_delta) where id = v_item.source_batch_id;
  end if;

  insert into public.inventory_movements (
    organization_id, branch_id, product_id, batch_id, type,
    quantity_delta, reference_id, reason, created_by
  )
  values (
    v_tr.organization_id, v_tr.from_branch_id, v_item.product_id, v_item.source_batch_id,
    'transfer', -v_delta, v_tr.id, 'Transfer edit', auth.uid()
  );

  if p_new_qty = 0 then
    delete from public.stock_transfer_items where id = p_item;
  else
    update public.stock_transfer_items set quantity = p_new_qty where id = p_item;
  end if;
end;
$$;

grant execute on function public.update_transfer_item_qty(uuid, integer) to authenticated;
