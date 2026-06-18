-- ============================================================================
-- Milestone 6 — Alerts: low-stock and expiring-batch views, plus expiry
-- write-off. Views are security_invoker so the underlying RLS applies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- v_low_stock — per product × branch where on-hand <= reorder point.
-- Includes zero-stock products (left join), unlike v_product_on_hand.
-- ---------------------------------------------------------------------------
create view public.v_low_stock
with (security_invoker = on) as
  select
    p.organization_id,
    br.id   as branch_id,
    br.name as branch_name,
    p.id    as product_id,
    p.name  as product_name,
    p.unit,
    p.reorder_point,
    coalesce(oh.on_hand, 0) as on_hand,
    greatest(p.reorder_point - coalesce(oh.on_hand, 0), 0) as deficit
  from public.products p
  join public.branches br
    on br.organization_id = p.organization_id and br.is_active
  left join public.v_product_on_hand oh
    on oh.product_id = p.id and oh.branch_id = br.id
  where p.is_active
    and p.reorder_point > 0
    and coalesce(oh.on_hand, 0) <= p.reorder_point;

-- ---------------------------------------------------------------------------
-- v_expiring_batches — non-zero batches expiring within 90 days (or expired),
-- with signed days_until (negative = already expired).
-- ---------------------------------------------------------------------------
create view public.v_expiring_batches
with (security_invoker = on) as
  select
    b.organization_id,
    b.branch_id,
    br.name as branch_name,
    b.product_id,
    p.name  as product_name,
    p.unit,
    b.id    as batch_id,
    b.batch_number,
    b.expiry_date,
    b.quantity,
    (b.expiry_date - (timezone('Asia/Manila', now()))::date) as days_until
  from public.batches b
  join public.products p on p.id = b.product_id
  join public.branches br on br.id = b.branch_id
  where b.quantity > 0
    and b.expiry_date is not null
    and b.expiry_date <= (timezone('Asia/Manila', now()))::date + 90;

-- ---------------------------------------------------------------------------
-- write_off_batch — zero out a batch (expiry/damage) and log the write-off.
-- manage_stock roles only (enforced by batches RLS, security invoker).
-- ---------------------------------------------------------------------------
create or replace function public.write_off_batch(
  p_batch uuid,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  b public.batches%rowtype;
begin
  if not public.has_org_role(array['owner','manager','pharmacist']::public.user_role[]) then
    raise exception 'You do not have permission to write off stock';
  end if;
  select * into b from public.batches where id = p_batch;
  if not found then
    raise exception 'Batch not found';
  end if;
  if b.quantity <= 0 then
    raise exception 'Batch has no stock to write off';
  end if;

  update public.batches set quantity = 0 where id = p_batch;

  insert into public.inventory_movements (
    organization_id, branch_id, product_id, batch_id, type, quantity_delta, reason, created_by
  )
  values (
    b.organization_id, b.branch_id, b.product_id, b.id, 'expiry_writeoff',
    -b.quantity, coalesce(nullif(p_reason, ''), 'Expiry write-off'), auth.uid()
  );
end;
$$;

grant execute on function public.write_off_batch(uuid, text) to authenticated;
