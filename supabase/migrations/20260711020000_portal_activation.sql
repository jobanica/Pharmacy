-- ============================================================================
-- Confirmed payments activate and extend the account.
--
-- Until now a portal callback only recorded its decision. This makes it act:
-- a confirmed activation unlocks the account, and confirmed monthly payments
-- push paid coverage forward.
--
-- Coverage is always RECOMPUTED from every confirmed payment rather than
-- incremented. That makes it idempotent (a replayed callback changes nothing)
-- and makes a reversal correct for free — the reversed payment simply stops
-- counting. Overlapping months do not stack: two receipts for November cover
-- November once, the same rule the billing page uses.
--
-- What this deliberately does NOT do:
--   * It never downgrades `plan` or suspends an account when coverage lapses.
--     Lapsed coverage shows as subscriptions.status = 'past_due' and nothing
--     else. Locking a pharmacy out of its own POS is a decision for a person,
--     not for a webhook that might have arrived out of order.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- The end of paid coverage for one org: the start of the month after the last
-- month any confirmed monthly payment covers. Manila midnight. Null if none.
-- ---------------------------------------------------------------------------
create or replace function public.paid_coverage_end(p_org uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  -- timezone(zone, timestamp) reads the naive timestamp AS Manila local time
  -- and returns the instant. Adding months to a date yields a timestamp, so
  -- the cast is explicit rather than left to string formatting.
  select max(
    timezone('Asia/Manila',
      (p.billing_month_start + make_interval(months => p.months_covered))::timestamp)
  )
  from public.subscription_manual_payments p
  where p.organization_id = p_org
    and p.type = 'monthly'
    and p.status = 'confirmed'
    and p.billing_month_start is not null;
$$;

-- ---------------------------------------------------------------------------
-- Apply what the confirmed payments add up to.
-- ---------------------------------------------------------------------------
create or replace function public.apply_paid_coverage(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activation boolean;
  v_until      timestamptz := public.paid_coverage_end(p_org);
  v_covered    boolean;
  v_entitled   boolean;
  v_status     text;
begin
  select exists (
    select 1 from public.subscription_manual_payments
    where organization_id = p_org and type = 'activation' and status = 'confirmed'
  ) into v_activation;

  -- Nothing confirmed for this org, ever: nothing to apply.
  if not v_activation and v_until is null then
    return;
  end if;

  v_covered := v_until is not null and v_until > now();
  -- Entitled when paid coverage is live, or when the pharmacy has just been
  -- activated and has not started monthly billing yet. Once any monthly
  -- payment has been confirmed, coverage alone governs: having paid the
  -- one-time activation fee last January is not a paid-up subscription today.
  v_entitled := v_covered or (v_until is null and v_activation);
  v_status := case when v_entitled then 'active' else 'past_due' end;

  insert into public.subscriptions (organization_id, plan, status, current_period_end)
  values (p_org, 'starter', v_status, v_until)
  on conflict (organization_id) do update
    set plan = 'starter',
        status = v_status,
        current_period_end = v_until;

  -- The paid plan unlocks every feature (one ₱800 tier).
  update public.organizations
  set plan = 'starter',
      -- Only lifts a suspension, never imposes one: a customer suspended for
      -- non-payment who pays is let back in; everything else an admin did by
      -- hand stays done until they undo it.
      status = case
                 when status = 'suspended' and v_entitled then 'active'
                 else status
               end
  where id = p_org;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hook it into the callback handler: same transaction as recording the
-- decision, so the inbox row and the account state can never disagree.
-- ---------------------------------------------------------------------------
create or replace function public.apply_portal_callback(
  p_event_id text,
  p_type     text,
  p_payload  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data    jsonb := p_payload -> 'data';
  v_ext     text  := v_data ->> 'external_customer_id';
  v_org     uuid;
  v_ref     text  := v_data ->> 'bank_reference';
  v_outcome text;
  v_hits    integer;
begin
  if exists (select 1 from public.product_callback_inbox where event_id = p_event_id) then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate');
  end if;

  begin
    v_org := v_ext::uuid;
  exception when others then
    v_org := null;
  end;

  if v_org is null or not exists (select 1 from public.organizations where id = v_org) then
    insert into public.product_callback_inbox (event_id, type, payload, outcome)
    values (p_event_id, p_type, p_payload, 'unknown_customer');
    return jsonb_build_object('ok', true, 'outcome', 'unknown_customer');
  end if;

  if p_type = 'contract.signed' then
    update public.organizations
    set contract_status = 'signed',
        contract_signed_at = coalesce((v_data ->> 'signed_at')::timestamptz, now()),
        contract_minimum_term_ends_at = (v_data ->> 'minimum_term_ends_at')::timestamptz
    where id = v_org;
    v_outcome := 'applied';

  elsif p_type in ('payment.confirmed', 'payment.rejected', 'payment.reversed') then
    update public.subscription_manual_payments
    set status = case p_type
                   when 'payment.confirmed' then 'confirmed'
                   when 'payment.rejected'  then 'rejected'
                   else 'reversed'
                 end,
        reason = nullif(trim(coalesce(v_data ->> 'reason', '')), ''),
        decided_at = now()
    where organization_id = v_org and bank_reference = v_ref;
    get diagnostics v_hits = row_count;

    if v_hits > 0 then
      -- Recomputed from every confirmed payment, so this is right whether the
      -- callback added coverage or took it away.
      perform public.apply_paid_coverage(v_org);
      v_outcome := 'applied';
    else
      v_outcome := 'unknown_payment';
    end if;

  else
    v_outcome := 'ignored';
  end if;

  insert into public.product_callback_inbox (event_id, type, payload, outcome)
  values (p_event_id, p_type, p_payload, v_outcome);

  return jsonb_build_object('ok', true, 'outcome', v_outcome);
end;
$$;
