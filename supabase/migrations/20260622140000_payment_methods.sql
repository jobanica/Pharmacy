-- ============================================================================
-- Milestone 4 — Split payments: extend payment_method enum.
-- ============================================================================

-- Postgres requires DDL to add enum values; cannot be done in a transaction
-- on older versions, but Supabase (PG 15) supports it fine.
alter type public.payment_method add value if not exists 'card';
alter type public.payment_method add value if not exists 'gcash';
alter type public.payment_method add value if not exists 'maya';
alter type public.payment_method add value if not exists 'other';

-- Add a flag so reports can quickly identify split-tender sales.
alter table public.sales
  add column if not exists is_split_tender boolean not null default false;
