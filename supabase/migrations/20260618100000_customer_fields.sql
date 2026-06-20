-- ============================================================================
-- Customer database — richer customer records (contact + profile fields).
-- ============================================================================
alter table public.customers add column address text;
alter table public.customers add column birthdate date;
alter table public.customers add column notes text;
