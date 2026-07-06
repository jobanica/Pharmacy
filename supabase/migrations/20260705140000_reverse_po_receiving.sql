-- Reverse all stock received against a purchase order (e.g. a worker scanned the
-- wrong receipt). Removes the received quantity from the batches the receiving
-- created, logs compensating movements, resets each line's received quantity,
-- and moves the PO back to 'sent' so it can be received again.
CREATE OR REPLACE FUNCTION public.reverse_po_receiving(p_po uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_org      uuid;
  v_branch   uuid;
  v_status   text;
  m          record;
  v_reversed integer := 0;
begin
  select organization_id, branch_id, status
  into v_org, v_branch, v_status
  from public.purchase_orders where id = p_po;

  if v_org is null then raise exception 'Purchase order not found'; end if;
  if v_org <> public.auth_org_id() then raise exception 'Purchase order is not in your organization'; end if;
  if not public.has_org_role(array['owner','manager','pharmacist','cashier']::public.user_role[]) then
    raise exception 'You do not have permission to reverse receiving';
  end if;

  -- Undo every receive movement logged for this PO.
  for m in
    select id, batch_id, product_id, quantity_delta
    from public.inventory_movements
    where reference_id = p_po and type = 'receive' and quantity_delta > 0
  loop
    if m.batch_id is not null then
      update public.batches
      set quantity = greatest(quantity - m.quantity_delta, 0)
      where id = m.batch_id;
    end if;

    insert into public.inventory_movements (
      organization_id, branch_id, product_id, batch_id, type,
      quantity_delta, reference_id, reason, created_by
    ) values (
      v_org, v_branch, m.product_id, m.batch_id, 'adjustment',
      -m.quantity_delta, p_po, 'Reversed PO receiving', auth.uid()
    );

    v_reversed := v_reversed + m.quantity_delta;
  end loop;

  update public.purchase_order_items set quantity_received = 0 where purchase_order_id = p_po;
  update public.purchase_orders set status = 'sent' where id = p_po and status = 'received';

  return jsonb_build_object('reversed_units', v_reversed);
end;
$function$;

grant execute on function public.reverse_po_receiving(uuid) to authenticated;
