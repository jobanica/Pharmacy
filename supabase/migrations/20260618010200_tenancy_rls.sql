-- ============================================================================
-- Milestone 2 — Row Level Security policies for the tenancy tables.
--
-- Core rule: a row is visible/writable only when its organization_id matches
-- the caller's org (public.auth_org_id()). Role checks layer on top via
-- public.has_org_role(...). All policies target `authenticated`; anon has no
-- membership and therefore sees nothing. INSERTs with no policy (organizations)
-- are performed only by SECURITY DEFINER functions or the service role.
-- ============================================================================

-- Helper: does the target user share the caller's organization? (definer to
-- avoid recursive RLS evaluation inside the profiles policy.)
create or replace function public.shares_org_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.user_id = target
      and m.organization_id = public.auth_org_id()
  );
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create policy "org members can view their organization"
  on public.organizations for select to authenticated
  using (id = public.auth_org_id());

create policy "owners can update their organization"
  on public.organizations for update to authenticated
  using (id = public.auth_org_id() and public.has_org_role(array['owner']::public.user_role[]))
  with check (id = public.auth_org_id());

-- ---------------------------------------------------------------------------
-- branches
-- ---------------------------------------------------------------------------
create policy "org members can view branches"
  on public.branches for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "owners can insert branches"
  on public.branches for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  );

create policy "owners can update branches"
  on public.branches for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  )
  with check (organization_id = public.auth_org_id());

create policy "owners can delete branches"
  on public.branches for delete to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "view own and same-org profiles"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id));

create policy "insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
create policy "org members can view memberships"
  on public.memberships for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "owners can insert memberships"
  on public.memberships for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  );

create policy "owners can update memberships"
  on public.memberships for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  )
  with check (organization_id = public.auth_org_id());

create policy "owners can delete memberships"
  on public.memberships for delete to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner']::public.user_role[])
  );

-- ---------------------------------------------------------------------------
-- invitations (owner/manager manage; acceptance goes through the RPC)
-- ---------------------------------------------------------------------------
create policy "managers can view invitations"
  on public.invitations for select to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner', 'manager']::public.user_role[])
  );

create policy "managers can create invitations"
  on public.invitations for insert to authenticated
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner', 'manager']::public.user_role[])
  );

create policy "managers can update invitations"
  on public.invitations for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner', 'manager']::public.user_role[])
  )
  with check (organization_id = public.auth_org_id());

create policy "managers can delete invitations"
  on public.invitations for delete to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner', 'manager']::public.user_role[])
  );
