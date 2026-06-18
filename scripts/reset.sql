-- ============================================================================
-- DESTRUCTIVE: wipe the project to a clean slate, then it is rebuilt from
-- supabase/migrations. Authorized by the project owner ("empty it and create
-- from scratch", including existing auth users).
--
-- Run order:  scripts/reset.sql  ->  supabase/migrations/*  ->  scripts/seed.mjs
-- ============================================================================

-- 1. Remove all authentication users (cascades to profiles/memberships via FK).
delete from auth.users;

-- 2. Drop and recreate the application schema (removes all domain tables,
--    types, functions, triggers, and policies).
drop schema if exists public cascade;
create schema public;

-- 3. Restore the default grants Supabase expects on the public schema.
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

-- 4. Forget applied-migration history so migrations re-apply cleanly.
delete from supabase_migrations.schema_migrations;
