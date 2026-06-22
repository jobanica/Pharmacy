-- ============================================================================
-- Milestone 3 — Prescription recording + Rx-gated dispensing.
--
-- RA 9165 (Dangerous Drugs Act) and FDA regulations require pharmacies to
-- retain prescription records for at minimum 2 years.
-- ============================================================================

create table public.prescriptions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  branch_id       uuid not null references public.branches (id) on delete cascade,
  rx_number       text,                         -- from the paper Rx if present
  patient_name    text not null,
  patient_dob     date,
  doctor_name     text not null,
  doctor_prc_no   text,                         -- PRC license number
  date_issued     date not null,
  notes           text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index prescriptions_org_idx     on public.prescriptions (organization_id);
create index prescriptions_branch_idx  on public.prescriptions (branch_id);
create index prescriptions_patient_idx on public.prescriptions (organization_id, patient_name);

alter table public.prescriptions enable row level security;

create policy "org members view prescriptions"
  on public.prescriptions for select to authenticated
  using (organization_id = public.auth_org_id());

create policy "members create prescriptions"
  on public.prescriptions for insert to authenticated
  with check (organization_id = public.auth_org_id());

create policy "managers update prescriptions"
  on public.prescriptions for update to authenticated
  using (
    organization_id = public.auth_org_id()
    and public.has_org_role(array['owner','manager','pharmacist']::public.user_role[])
  )
  with check (organization_id = public.auth_org_id());

-- Link prescriptions to the sale they were dispensed on.
alter table public.sales
  add column if not exists prescription_id uuid references public.prescriptions (id) on delete set null;

create index if not exists sales_prescription_idx on public.sales (prescription_id);
