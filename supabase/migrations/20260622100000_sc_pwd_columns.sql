-- ============================================================================
-- Milestone 2 — SC/PWD discounts + VAT exemption
--
-- RA 9994 (Expanded Senior Citizens Act): 20% discount + VAT exemption on
-- medicines for senior citizens (60+).
-- RA 10754 (PWD Act of 2015): 20% discount + VAT exemption on medicines
-- for persons with disability.
--
-- Discount formula (BIR Revenue Regulations):
--   net_of_vat = price / (1 + vat_rate/100)
--   discounted_price = net_of_vat * 0.80   (20% off net)
--   sale is entirely VAT-exempt (zero VAT)
-- ============================================================================

alter table public.sales
  add column if not exists discount_type        text not null default 'none',
  add column if not exists beneficiary_id_no    text,
  add column if not exists beneficiary_name     text,
  add column if not exists vat_exempt_centavos  integer not null default 0;

-- Index to make logbook queries fast.
create index if not exists sales_discount_type_idx
  on public.sales (organization_id, discount_type)
  where discount_type <> 'none';
