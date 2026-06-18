-- ============================================================================
-- Milestone 2 — Tenancy functions, sign-up trigger, and invite acceptance.
--
-- The auth_* helpers are SECURITY DEFINER so they read `memberships` WITHOUT
-- triggering RLS — this is what lets RLS policies reference the caller's org
-- without infinite recursion. They are the backbone of tenant isolation.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- slugify — url-safe slug from arbitrary text
-- ---------------------------------------------------------------------------
create or replace function public.slugify(txt text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------------
-- auth_org_id — the active organization of the current user (or null)
-- ---------------------------------------------------------------------------
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.organization_id
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- auth_role — the current user's role within their org (or null)
-- ---------------------------------------------------------------------------
create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.memberships m
  where m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- has_org_role — does the current user hold any of the given roles?
-- ---------------------------------------------------------------------------
create or replace function public.has_org_role(roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user — runs after a user is created in auth.users.
--   * Always creates a profile.
--   * If sign-up metadata carries `org_name`, bootstraps a new organization,
--     a first branch, and an owner membership (the self-serve sign-up path).
--   * Invited users sign up WITHOUT org metadata; they get only a profile and
--     join an org later via accept_invitation().
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id    uuid;
  v_branch_id uuid;
  v_slug      text;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );

  if new.raw_user_meta_data ? 'org_name' then
    v_slug := public.slugify(new.raw_user_meta_data ->> 'org_name')
              || '-' || substr(md5(random()::text), 1, 6);

    insert into public.organizations (name, slug)
    values (new.raw_user_meta_data ->> 'org_name', v_slug)
    returning id into v_org_id;

    insert into public.branches (organization_id, name)
    values (
      v_org_id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'branch_name'), ''), 'Main Branch')
    )
    returning id into v_branch_id;

    insert into public.memberships (organization_id, user_id, role, default_branch_id, status)
    values (v_org_id, new.id, 'owner', v_branch_id, 'active');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- accept_invitation — invited user joins an org via a token.
-- SECURITY DEFINER so the (not-yet-member) caller can read the invitation and
-- insert their membership despite RLS. Validates token, expiry, and that the
-- caller's email matches the invite.
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite   public.invitations%rowtype;
  v_email    text;
  v_branch   uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.invitations
  where token = invite_token
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Invitation has expired';
  end if;

  select email into v_email from auth.users where id = auth.uid();
  if lower(v_email) <> lower(v_invite.email) then
    raise exception 'Invitation was issued to a different email address';
  end if;

  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    raise exception 'User already belongs to an organization';
  end if;

  select id into v_branch
  from public.branches
  where organization_id = v_invite.organization_id and is_active
  order by created_at
  limit 1;

  insert into public.memberships (organization_id, user_id, role, default_branch_id, status)
  values (v_invite.organization_id, auth.uid(), v_invite.role, v_branch, 'active');

  update public.invitations set accepted_at = now() where id = v_invite.id;

  return v_invite.organization_id;
end;
$$;

-- Authenticated users invoke accept_invitation; the auth_* helpers are used
-- inside policies and run as definer regardless of caller grants.
grant execute on function public.accept_invitation(text) to authenticated;
