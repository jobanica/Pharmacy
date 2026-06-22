-- ============================================================================
-- Enable Supabase Realtime for online orders.
--   Staff subscribe to INSERT/UPDATE events on public.orders for the live
--   new-order popup. Realtime applies the existing "org members view orders"
--   RLS policy, so each cashier only receives events for their own org.
-- ============================================================================
alter publication supabase_realtime add table public.orders;
