-- ============================================================================
-- Milestone 13 — Notifications.
-- Persistent in-app notification feed generated from alert conditions.
-- ============================================================================

create type public.notification_type as enum (
  'low_stock',
  'expiry_warning',
  'transfer_received',
  'return_processed',
  'shift_variance'
);

create table public.notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id       uuid references public.branches (id) on delete cascade,
  -- null = visible to all org members; set to a user_id to target one person
  user_id         uuid references auth.users (id) on delete cascade,
  type            public.notification_type not null,
  title           text not null,
  body            text,
  resource_id     uuid,       -- e.g. product_id, transfer_id, return_id
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index notifications_org_idx    on public.notifications (organization_id, created_at desc);
create index notifications_user_idx   on public.notifications (user_id, read_at) where user_id is not null;
create index notifications_branch_idx on public.notifications (branch_id) where branch_id is not null;

alter table public.notifications enable row level security;

-- Members see org-wide notifications for their org, or ones addressed to them.
create policy "members view own notifications"
  on public.notifications for select to authenticated
  using (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  );

create policy "members update own notifications"
  on public.notifications for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  )
  with check (
    organization_id = public.auth_org_id()
    and (user_id is null or user_id = auth.uid())
  );

-- Only server-side (service role) inserts notifications.
-- App layer uses service client for generation.

-- ============================================================================
-- generate_alert_notifications(p_branch uuid)
-- Idempotent: inserts a notification only when no unread one for the same
-- type+resource already exists within the last 24 hours.
-- ============================================================================
create or replace function public.generate_alert_notifications(
  p_branch uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org     uuid;
  v_count   int := 0;
  v_rows    int;
  v_cutoff  timestamptz := now() - interval '24 hours';
begin
  select organization_id into v_org
  from public.branches where id = p_branch;
  if not found then return 0; end if;

  -- Low-stock notifications (one per product below reorder point).
  insert into public.notifications
    (organization_id, branch_id, type, title, body, resource_id)
  select
    v_org,
    p_branch,
    'low_stock',
    ls.product_name || ' is low on stock',
    'On hand: ' || ls.on_hand || ' ' || ls.unit ||
      ' — reorder point: ' || ls.reorder_point ||
      ' (deficit ' || ls.deficit || ')',
    ls.product_id
  from public.v_low_stock ls
  where ls.branch_id = p_branch
    and not exists (
      select 1 from public.notifications n
      where n.organization_id = v_org
        and n.branch_id = p_branch
        and n.type = 'low_stock'
        and n.resource_id = ls.product_id
        and n.read_at is null
        and n.created_at > v_cutoff
    );
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  -- Expiry warning notifications (batches expiring within 30 days).
  insert into public.notifications
    (organization_id, branch_id, type, title, body, resource_id)
  select
    v_org,
    p_branch,
    'expiry_warning',
    eb.product_name || ' expiring ' ||
      case when eb.days_until <= 0 then '(expired)'
           when eb.days_until = 1 then 'tomorrow'
           else 'in ' || eb.days_until || ' days'
      end,
    'Batch ' || coalesce(eb.batch_number, 'unbatched') ||
      ' · ' || eb.quantity || ' ' || eb.unit ||
      ' · Expires ' || to_char(eb.expiry_date::date, 'Mon DD, YYYY'),
    eb.batch_id
  from public.v_expiring_batches eb
  where eb.branch_id = p_branch
    and eb.days_until <= 30
    and not exists (
      select 1 from public.notifications n
      where n.organization_id = v_org
        and n.branch_id = p_branch
        and n.type = 'expiry_warning'
        and n.resource_id = eb.batch_id
        and n.read_at is null
        and n.created_at > v_cutoff
    );
  get diagnostics v_rows = row_count;
  v_count := v_count + v_rows;

  return v_count;
end;
$$;

grant execute on function public.generate_alert_notifications(uuid) to authenticated;
