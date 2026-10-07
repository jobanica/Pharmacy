-- ============================================================================
-- Auto-suspend after a 7-day grace period.
--
-- A lapse happens by the passage of time — no callback fires when coverage
-- simply runs out — so this is swept on a schedule rather than driven by an
-- event. The outbox cron calls it.
--
-- Scope is deliberately narrow. Only an account that
--   * signed up through an agent (agent_code is not null), AND
--   * has had at least one monthly payment confirmed (so paid coverage exists
--     and then ran out)
-- is ever touched. A pharmacy that never went through this flow has no
-- coverage to lapse and is invisible to this function — existing customers
-- keep working exactly as before.
--
-- A newly activated account that has not started monthly billing yet has no
-- coverage end, so it is never suspended for "lapsing" before its first month.
-- ============================================================================

create or replace function public.suspend_lapsed_accounts(p_grace_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org   uuid;
  v_count integer := 0;
begin
  for v_org in
    select o.id
    from public.organizations o
    cross join lateral (select public.paid_coverage_end(o.id) as paid_until) c
    where o.agent_code is not null
      and o.status = 'active'
      -- Null means no confirmed monthly payment has ever existed for this
      -- account: nothing has lapsed, so there is nothing to suspend.
      and c.paid_until is not null
      and now() > c.paid_until + make_interval(days => p_grace_days)
  loop
    -- Reused so the status change and the customer.cancelled event are written
    -- together, exactly as when an admin suspends by hand.
    perform public.set_organization_status(v_org, 'suspended', 'subscription lapsed');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paying again lifts the suspension — and now tells the portal so.
--
-- Previously this flipped organizations.status directly, which left the portal
-- believing a customer was still cancelled after they had paid. Routing it
-- through set_organization_status() keeps the two in step: a suspension sends
-- customer.cancelled, and being let back in sends customer.reactivated.
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
  v_org_status text;
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
  update public.organizations set plan = 'starter' where id = p_org;

  -- Only lifts a suspension, never imposes one. Suspending is the sweep's job
  -- (and an admin's); a callback that arrived out of order must not lock a
  -- pharmacy out of its own POS.
  select status into v_org_status from public.organizations where id = p_org;
  if v_org_status = 'suspended' and v_entitled then
    perform public.set_organization_status(p_org, 'active');
  end if;
end;
$$;
