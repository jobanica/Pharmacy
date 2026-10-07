-- ============================================================================
-- CANVEXIA agent portal — the transactional edges.
--
-- Every function here does a business change and queues the matching event in
-- product_event_outbox in ONE transaction, so an event can never be lost and a
-- portal outage can never fail the user's request. Nothing here talks to the
-- portal; the cron worker does that afterwards.
--
-- Deliberately absent: anything that changes a plan, an account status, or
-- billing coverage off the back of a portal callback. Confirming a receipt
-- records the confirmation only — how Reseta activates and bills is unchanged.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Queue any product event for an org. Only orgs with an agent_code are
-- reported to the portal; for everyone else this is a no-op, which is how
-- existing customers keep working exactly as before.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_product_event(
  p_org  uuid,
  p_type text,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id text := 'evt_' || gen_random_uuid()::text;
begin
  if not exists (
    select 1 from public.organizations
    where id = p_org and agent_code is not null
  ) then
    return;
  end if;

  insert into public.product_event_outbox (organization_id, event_id, type, payload)
  values (
    p_org,
    v_event_id,
    p_type,
    jsonb_build_object(
      'event_id', v_event_id,
      'type', p_type,
      'occurred_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'data', p_data || jsonb_build_object('external_customer_id', p_org::text)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- An owner submits a bank-transfer receipt.
--
-- The payment row and the payment.submitted event are written together. A bank
-- reference this product has already seen is refused outright — the unique
-- index is the real guard, this check is only there to give a sentence back
-- instead of a constraint error.
-- ---------------------------------------------------------------------------
create or replace function public.submit_manual_payment(
  p_type         text,
  p_months       integer,
  p_month_start  date,
  p_amount       integer,
  p_bank_ref     text,
  p_receipt_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid := public.auth_org_id();
  v_contract text;
  v_id       uuid;
  v_ref      text := trim(p_bank_ref);
  v_months   integer;
  v_start    date;
begin
  if v_org is null then
    return jsonb_build_object('ok', false, 'error', 'You are not signed in to a pharmacy.');
  end if;
  if not public.has_org_role(array['owner']::public.user_role[]) then
    return jsonb_build_object('ok', false, 'error', 'Only the pharmacy owner can submit a payment.');
  end if;
  if p_type not in ('activation', 'monthly') then
    return jsonb_build_object('ok', false, 'error', 'Choose what this payment is for.');
  end if;
  if coalesce(length(v_ref), 0) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Enter the bank reference number from your receipt.');
  end if;

  -- The same reference twice is the same payment twice.
  if exists (select 1 from public.subscription_manual_payments where bank_reference = v_ref) then
    return jsonb_build_object(
      'ok', false,
      'error', 'That bank reference has already been submitted. Check your payment history below.'
    );
  end if;

  if p_type = 'activation' then
    select contract_status into v_contract from public.organizations where id = v_org;
    if v_contract is distinct from 'signed' then
      return jsonb_build_object(
        'ok', false,
        'error', 'Please sign the service agreement before submitting your activation payment.'
      );
    end if;
    -- One activation per pharmacy: not once confirmed, and not while one is
    -- already waiting for review.
    if exists (
      select 1 from public.subscription_manual_payments
      where organization_id = v_org and type = 'activation'
        and status in ('submitted', 'confirmed')
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'Your activation payment has already been submitted.'
      );
    end if;
    v_months := 1;
    v_start := null;
  else
    if p_month_start is null then
      return jsonb_build_object('ok', false, 'error', 'Choose the first month this payment covers.');
    end if;
    v_months := greatest(1, coalesce(p_months, 1));
    v_start := date_trunc('month', p_month_start)::date;
  end if;

  insert into public.subscription_manual_payments (
    organization_id, type, months_covered, billing_month_start,
    amount_centavos, bank_reference, receipt_path, submitted_by
  )
  values (
    v_org, p_type, v_months, v_start, p_amount, v_ref,
    nullif(trim(coalesce(p_receipt_path, '')), ''),
    auth.uid()
  )
  returning id into v_id;

  -- Same transaction as the payment row.
  perform public.enqueue_product_event(
    v_org,
    'payment.submitted',
    jsonb_strip_nulls(jsonb_build_object(
      'type', p_type,
      'months_covered', v_months,
      'billing_month_start', case when v_start is null then null else to_char(v_start, 'YYYY-MM') end,
      'amount', p_amount,
      'bank_reference', v_ref,
      'receipt_path', nullif(trim(coalesce(p_receipt_path, '')), '')
    ))
  );

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.submit_manual_payment(text, integer, date, integer, text, text) from public;
grant execute on function public.submit_manual_payment(text, integer, date, integer, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- A super-admin suspends or reactivates a subscriber. The status change and
-- the event go together.
-- ---------------------------------------------------------------------------
create or replace function public.set_organization_status(
  p_org    uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'unsupported status %', p_status;
  end if;

  select status into v_old from public.organizations where id = p_org;
  if v_old is null or v_old = p_status then return; end if;

  update public.organizations set status = p_status where id = p_org;

  if p_status = 'suspended' then
    perform public.enqueue_product_event(
      p_org, 'customer.cancelled',
      jsonb_strip_nulls(jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), '')))
    );
  else
    perform public.enqueue_product_event(p_org, 'customer.reactivated', '{}'::jsonb);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Apply one portal callback.
--
-- Dedupe and application share a transaction: the inbox row is the dedupe key,
-- so a replayed callback inserts nothing and changes nothing. Returns the
-- outcome for the route handler to log.
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
  -- Already seen? Say so and touch nothing.
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
    -- Recording the portal's decision only. Plan, account status and billing
    -- coverage are untouched by design.
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
    v_outcome := case when v_hits > 0 then 'applied' else 'unknown_payment' end;

  else
    v_outcome := 'ignored';
  end if;

  insert into public.product_callback_inbox (event_id, type, payload, outcome)
  values (p_event_id, p_type, p_payload, v_outcome);

  return jsonb_build_object('ok', true, 'outcome', v_outcome);
end;
$$;
