-- ============================================================================
-- HR — employees, leave requests, and the data behind timesheets / late
-- reports / payroll (Pro). Attendance (clock in/out) already exists; this adds
-- the employee master record and leave workflow. Timesheets, late reports and
-- payroll are computed in the app from `attendance` joined to `employees`
-- via user_id, so no extra tables are needed for them.
-- ============================================================================

create type public.employee_pay_type as enum ('hourly', 'daily', 'monthly');
create type public.leave_kind as enum ('vacation', 'sick', 'emergency', 'unpaid', 'maternity', 'paternity');
create type public.leave_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- employees — the HR master record. Optionally linked to an auth user
-- (user_id) so attendance rows can be attributed for timesheets and payroll.
-- ---------------------------------------------------------------------------
create table public.employees (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  branch_id          uuid references public.branches (id) on delete set null,
  user_id            uuid references auth.users (id) on delete set null,
  full_name          text not null,
  position           text,
  email              text,
  phone              text,
  pay_type           public.employee_pay_type not null default 'monthly',
  pay_rate_centavos  bigint not null default 0,
  work_start         time not null default '09:00',
  work_hours_per_day numeric not null default 8,
  grace_minutes      int not null default 0,
  hire_date          date,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);
create index employees_org_idx on public.employees (organization_id);
create index employees_user_idx on public.employees (user_id);
create index employees_branch_idx on public.employees (branch_id);

alter table public.employees enable row level security;

-- Owners/managers manage the org's employee records.
create policy "managers manage employees"
  on public.employees for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager']::public.user_role[])
  );

-- ---------------------------------------------------------------------------
-- leave_requests — filed against an employee, approved/rejected by a manager.
-- ---------------------------------------------------------------------------
create table public.leave_requests (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_id     uuid not null references public.employees (id) on delete cascade,
  leave_type      public.leave_kind not null default 'vacation',
  start_date      date not null,
  end_date        date not null,
  reason          text,
  status          public.leave_status not null default 'pending',
  reviewed_by     uuid references auth.users (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index leave_requests_org_idx on public.leave_requests (organization_id, created_at desc);
create index leave_requests_employee_idx on public.leave_requests (employee_id);

alter table public.leave_requests enable row level security;

create policy "managers manage leave"
  on public.leave_requests for all to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager']::public.user_role[])
  )
  with check (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager']::public.user_role[])
  );
