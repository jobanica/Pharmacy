-- ============================================================================
-- HRIS — time & attendance: QR clock in/out with selfie verification (Pro).
-- ============================================================================

create type public.attendance_kind as enum ('clock_in', 'clock_out');

-- Per-branch token embedded in the printable clock-in QR poster.
alter table public.branches
  add column clock_token text not null default encode(gen_random_bytes(9), 'hex');
create unique index branches_clock_token_idx on public.branches (clock_token);

-- Append-only attendance log. photo_path points at the private 'attendance'
-- storage bucket (selfie captured at clock time).
create table public.attendance (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id       uuid not null references public.branches (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  kind            public.attendance_kind not null,
  photo_path      text,
  created_at      timestamptz not null default now()
);
create index attendance_org_idx on public.attendance (organization_id);
create index attendance_user_idx on public.attendance (user_id, created_at desc);
create index attendance_branch_idx on public.attendance (branch_id, created_at desc);

alter table public.attendance enable row level security;

-- Owners/managers see all org attendance; everyone can see + create their own.
create policy "view org or own attendance"
  on public.attendance for select to authenticated
  using (
    organization_id = public.auth_org_id()
    and (
      public.has_org_role(array['owner','manager']::public.user_role[])
      or user_id = auth.uid()
    )
  );
create policy "clock self in/out"
  on public.attendance for insert to authenticated
  with check (organization_id = public.auth_org_id() and user_id = auth.uid());

-- Private bucket for selfie photos (served via signed URLs from the server).
insert into storage.buckets (id, name, public)
values ('attendance', 'attendance', false)
on conflict (id) do nothing;
