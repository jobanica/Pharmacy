-- ============================================================================
-- White-label branding — public bucket for pharmacy logos.
-- Brand name, logo, and receipt/printer preferences live in
-- organizations.settings (jsonb), readable by org members via existing RLS.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;
