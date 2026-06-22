-- ============================================================================
-- Platform super-admins — users who manage every subscriber via /admin.
--   Separate from per-org roles. The dashboard reads/writes with the service
--   role from actions guarded by requirePlatformAdmin(). The PLATFORM_ADMIN_EMAILS
--   env allowlist is the other (zero-config) source of admins.
-- ============================================================================
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- A signed-in user may check whether they themselves are an admin; nobody can
-- enumerate the table from the client.
create policy "admin reads self"
  on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- Seed any already-registered bootstrap admin.
insert into public.platform_admins (user_id, email)
select id, email from auth.users where lower(email) = 'john2caal@gmail.com'
on conflict (user_id) do nothing;
