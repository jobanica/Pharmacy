-- Platform-wide settings, managed only by super-admins from /admin.
-- Single-row table (id is always true). Holds the Xendit billing credentials
-- so the SaaS operator can accept subscription payments without redeploying.
create table if not exists public.platform_settings (
  id boolean primary key default true,
  xendit_secret_key text,
  xendit_webhook_token text,
  billing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

-- Lock it down: RLS on, no policies => only the service role (used by
-- server-side admin actions and webhooks) can read or write. Secret keys never
-- reach the browser or any RLS-scoped client.
alter table public.platform_settings enable row level security;

insert into public.platform_settings (id) values (true)
  on conflict (id) do nothing;
