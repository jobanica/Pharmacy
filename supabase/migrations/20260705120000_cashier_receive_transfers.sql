-- Allow cashiers to receive incoming stock transfers.
-- Only the role check changes; the receiving logic is unchanged.
CREATE OR REPLACE FUNCTION public.receive_transfer(p_transfer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  if not public.has_org_role(array['owner','manager','pharmacist','cashier']::public.user_role[]) then
    raise exception 'You do not have permission to receive transfers';
  end if;

  select plan into v_plan from public.organizations where id = v_org;
  v_track := coalesce(v_plan, 'free') in ('starter', 'pro');

  for item in
    select product_id, source_batch_id, quantity, unit_cost_centavos
    from public.stock_transfer_items
    where transfer_id = p_transfer
  loop
    if v_track then
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
