-- ============================================================================
-- Show the supplier on expiring stock (so near-expiry items reveal who supplied
-- them). Recreate v_expiring_batches with a supplier_name join.
-- ============================================================================
drop view if exists public.v_expiring_batches;

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
    sup.name as supplier_name,
    (b.expiry_date - (timezone('Asia/Manila', now()))::date) as days_until
  from public.batches b
  join public.products p on p.id = b.product_id
  join public.branches br on br.id = b.branch_id
  left join public.suppliers sup on sup.id = b.supplier_id
  where b.quantity > 0
    and b.expiry_date is not null
    and b.expiry_date <= (timezone('Asia/Manila', now()))::date + 90;
