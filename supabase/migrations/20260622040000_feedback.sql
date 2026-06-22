-- ============================================================================
-- Feedback — in-app "Send feedback" messages routed to the developers.
--   Members submit feedback scoped to themselves; only the service role (the
--   platform admin dashboard) reads it.
-- ============================================================================
create table if not exists public.feedback (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  user_id         uuid references auth.users (id) on delete set null,
  user_email      text,
  category        text not null default 'general',
  message         text not null check (length(trim(message)) > 0),
  created_at      timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "members submit feedback"
  on public.feedback for insert to authenticated
  with check (user_id = auth.uid());
