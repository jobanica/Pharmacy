-- ============================================================================
-- Milestone 2 — public invitation lookup.
--
-- The accept-invite page must show the target email, role, and organization
-- BEFORE the invited user has an account (so RLS cannot apply). This SECURITY
-- DEFINER function exposes only the minimal, non-sensitive fields for a valid,
-- pending, unexpired invite. Returns no rows for invalid/used/expired tokens.
-- ============================================================================
create or replace function public.invitation_details(invite_token text)
returns table (
  email             text,
  role              public.user_role,
  organization_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.email, i.role, o.name
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token = invite_token
    and i.accepted_at is null
    and i.expires_at > now();
$$;

grant execute on function public.invitation_details(text) to anon, authenticated;
