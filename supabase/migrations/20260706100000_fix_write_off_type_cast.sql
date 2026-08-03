-- ============================================================================
-- Fix: write_off_stock failed with "column 'type' is of type movement_type but
-- expression is of type text".
--
-- The CASE expression that picks the movement type resolves to `text`, and
-- Postgres won't implicitly cast text into the movement_type enum column on
-- INSERT. Cast the CASE result to public.movement_type.
--
-- Replaces the function in place (same signature) so already-migrated
-- databases pick up the fix.
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
