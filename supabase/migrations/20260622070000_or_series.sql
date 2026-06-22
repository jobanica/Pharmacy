-- ============================================================================
-- Milestone 1 (Tax & receipts) — Step 2: per-org OR sequences + VAT settings.
--
-- BIR CAS (Computerized Accounting System) accreditation required before
-- these receipts qualify as legally-valid Official Receipts under RR 10-2019.
-- The sequence is gapless once seeded; do NOT reset it after go-live.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Per-org OR sequence table (avoids DDL per new org; achieves the same
-- gapless guarantee via SELECT ... FOR UPDATE on the counter row).
-- ---------------------------------------------------------------------------
create table public.or_sequences (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  last_number     bigint not null default 0
);

alter table public.or_sequences enable row level security;

create policy "org owners read or_sequences"
  on public.or_sequences for select to authenticated
  using (organization_id = public.auth_org_id());

-- Seed existing orgs.
insert into public.or_sequences (organization_id)
select id from public.organizations
on conflict do nothing;

-- Auto-seed new orgs via trigger.
create or replace function public.seed_or_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.or_sequences (organization_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger trg_seed_or_sequence
  after insert on public.organizations
  for each row execute function public.seed_or_sequence();

-- ---------------------------------------------------------------------------
-- generate_or_number — security definer, increments atomically, returns the
-- formatted OR string.  Called inside complete_sale.
--
-- BIR CAS note: OR prefix and padding are org-configurable in settings; the
-- default is "OR-0000001" (prefix "OR", 7 digits).
-- ---------------------------------------------------------------------------
create or replace function public.generate_or_number(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next   bigint;
  v_prefix text;
  v_pad    integer;
begin
  -- Lock this org's counter row, increment, read back.
  update public.or_sequences
  set    last_number = last_number + 1
  where  organization_id = p_org
  returning last_number into v_next;

  if v_next is null then
    -- Org didn't have a row yet (race with trigger); insert and return 1.
    insert into public.or_sequences (organization_id, last_number)
    values (p_org, 1)
    on conflict (organization_id) do update set last_number = or_sequences.last_number + 1
    returning last_number into v_next;
  end if;

  select
    coalesce(settings #>> '{tax,or_prefix}', 'OR'),
    coalesce((settings #>> '{tax,or_padding}')::integer, 7)
  into v_prefix, v_pad
  from public.organizations
  where id = p_org;

  return v_prefix || '-' || lpad(v_next::text, v_pad, '0');
end;
$$;

grant execute on function public.generate_or_number(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Migrate existing receipt_number values into the new OR sequences so that
-- the counter never goes backwards.  Existing numbers were zero-padded 6-digit
-- per-branch counts, so we take the per-org max across branches.
-- ---------------------------------------------------------------------------
update public.or_sequences os
set last_number = coalesce((
  select max(
    case
      when s.receipt_number ~ '^\d+$' then s.receipt_number::bigint
      when s.receipt_number ~ '-(\d+)$' then
        (regexp_match(s.receipt_number, '-(\d+)$'))[1]::bigint
      else 0
    end
  )
  from public.sales s
  where s.organization_id = os.organization_id
), 0)
where last_number = 0;
