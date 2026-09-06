-- ============================================================================
-- Donations: allow a 'donated' reason in write_off_stock so donated / given-away
-- medicine is recorded (and stock deducted) the same way as expired/damaged,
-- but tracked separately on its own Donations tab.
-- Reproduces the current cost-fallback version of the function, adding 'donated'.
-- ============================================================================
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
  if v_reason not in ('expired', 'damaged', 'other', 'donated') then v_reason := 'other'; end if;

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
    -p_quantity,
    (case when v_reason = 'donated' then 'Donation' else 'Write-off (' || v_reason || ')' end)
      || coalesce(': ' || nullif(p_notes, ''), ''),
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
