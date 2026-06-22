-- ============================================================================
-- Milestone 1 (Tax & receipts) — Step 1: sale_payments table.
-- Stores one tender row per sale. Dual-written by complete_sale alongside the
-- existing payment_method / amount_tendered_centavos columns on sales (kept for
-- backward-compat). Milestone 4 (split tender) will loosen the constraint.
-- ============================================================================

create table public.sale_payments (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  sale_id             uuid not null references public.sales (id) on delete cascade,
  method              text not null,           -- 'cash','card','gcash','maya', …
  amount_centavos     integer not null check (amount_centavos > 0),
  reference           text,                    -- card auth code, GCash ref, etc.
  created_at          timestamptz not null default now()
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);
create index sale_payments_org_idx  on public.sale_payments (organization_id);

alter table public.sale_payments enable row level security;

create policy "org members view sale payments"
  on public.sale_payments for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "members create sale payments"
  on public.sale_payments for insert to authenticated
  with check (organization_id = public.auth_org_id());

-- Back-fill existing sales so the table is coherent from day one.
insert into public.sale_payments (organization_id, sale_id, method, amount_centavos)
select organization_id, id, payment_method::text, greatest(amount_tendered_centavos, total_centavos)
from   public.sales
where  status = 'completed';
