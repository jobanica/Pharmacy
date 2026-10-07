import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

import {
  canonicalString,
  signRequest,
  signedHeaders,
  verifyRequest,
  SIGNATURE_HEADERS,
} from "@/lib/agent-kit/signing";
import {
  REF_COOKIE,
  normalizeReferralCode,
  refFromSearchParams,
} from "@/lib/agent-kit/ref";
import { productEventSchema } from "@/lib/agent-kit/events";
import { portalCallbackSchema } from "@/lib/agent-kit/callbacks";
import {
  deliverEvent,
  retryDelayMs,
  verifyCallback,
  type AgentPortalConfig,
} from "@/lib/agent-kit/client";
import { nextPerCustomer } from "@/lib/portal/ordering";
import { GRACE_DAYS, suspendsAt } from "@/lib/portal/grace";
import { coverageEnd, nextBillingMonth, parseReceiptForm } from "@/lib/agent-kit/billing";

/**
 * The agent-portal integration's own suite.
 *
 * Run with: npm test
 *
 * No test framework and no network: node:test plus a fake fetch. The point is
 * the rules that are expensive to get wrong — a signature that can be
 * replayed, a referral code that gets overwritten, an event that reaches the
 * portal out of order, a bank reference submitted twice.
 */

const config: AgentPortalConfig = {
  baseUrl: "https://portal.example",
  productSlug: "reseta",
  secret: "test-secret-not-a-real-one",
};

const NOW = new Date("2026-10-07T12:00:00Z");
const ts = String(Math.floor(NOW.getTime() / 1000));

// ---------------------------------------------------------------------------
// 1. A signature covers the method, the path and the exact body bytes.
// ---------------------------------------------------------------------------
test("a signature is bound to the method, path and raw body", () => {
  const body = JSON.stringify({ a: 1, b: 2 });
  const sig = signRequest(config.secret, ts, "POST", "/api/v1/events", body);

  assert.match(sig, /^sha256=[0-9a-f]{64}$/);
  assert.equal(
    canonicalString(ts, "post", "/api/v1/events", body),
    `${ts}.POST./api/v1/events.${body}`,
    "the method is uppercased into the signed string",
  );

  // Same bytes, different endpoint: a captured signature cannot be moved.
  assert.notEqual(
    sig,
    signRequest(config.secret, ts, "POST", "/api/v1/receipts", body),
  );
  // Same JSON, re-serialized with different key order: different signature.
  // This is why verification must use the raw text, never a parse/stringify.
  assert.notEqual(
    sig,
    signRequest(config.secret, ts, "POST", "/api/v1/events", JSON.stringify({ b: 2, a: 1 })),
  );
});

// ---------------------------------------------------------------------------
// 2. Verification accepts what we signed and refuses replays and tampering.
// ---------------------------------------------------------------------------
test("verification refuses a stale timestamp, a wrong secret and a changed body", () => {
  const body = JSON.stringify({ event_id: "evt_1" });
  const headers = signedHeaders({
    productSlug: config.productSlug,
    secret: config.secret,
    method: "POST",
    pathname: "/api/portal/callback",
    rawBody: body,
    now: NOW,
  });
  const base = {
    secret: config.secret,
    timestamp: headers[SIGNATURE_HEADERS.timestamp],
    signature: headers[SIGNATURE_HEADERS.signature],
    method: "POST",
    pathname: "/api/portal/callback",
    rawBody: body,
  };

  assert.deepEqual(verifyRequest({ ...base, now: NOW }), { ok: true });

  // Captured and replayed an hour later.
  assert.deepEqual(
    verifyRequest({ ...base, now: new Date(NOW.getTime() + 60 * 60 * 1000) }),
    { ok: false, reason: "stale" },
  );
  // Pre-signed for the future.
  assert.deepEqual(
    verifyRequest({ ...base, now: new Date(NOW.getTime() - 60 * 60 * 1000) }),
    { ok: false, reason: "stale" },
  );
  // Body edited in flight, signature left alone.
  assert.deepEqual(
    verifyRequest({ ...base, rawBody: JSON.stringify({ event_id: "evt_2" }), now: NOW }),
    { ok: false, reason: "bad_signature" },
  );
  // Someone else's secret.
  assert.deepEqual(
    verifyRequest({ ...base, secret: "other-secret", now: NOW }),
    { ok: false, reason: "bad_signature" },
  );
  // Nothing presented at all.
  assert.deepEqual(
    verifyRequest({ ...base, signature: null, now: NOW }),
    { ok: false, reason: "malformed" },
  );
});

// ---------------------------------------------------------------------------
// 3. Referral codes are normalized to one stored form, uppercase.
// ---------------------------------------------------------------------------
test("a referral code is stored uppercase, and junk reads as no code", () => {
  assert.equal(normalizeReferralCode("ab-12 cd"), "AB12CD");
  assert.equal(normalizeReferralCode("agent001"), "AGENT001");
  assert.equal(normalizeReferralCode("  ZEN9  "), "ZEN9");

  // Too short, too long, or not a code at all.
  assert.equal(normalizeReferralCode("AB1"), null);
  assert.equal(normalizeReferralCode("A".repeat(21)), null);
  assert.equal(normalizeReferralCode("ref@code"), null);
  assert.equal(normalizeReferralCode(""), null);
  assert.equal(normalizeReferralCode(null), null);

  assert.equal(
    refFromSearchParams(new URLSearchParams("?ref=zen-9x1&utm_source=fb")),
    "ZEN9X1",
  );
  assert.equal(refFromSearchParams(new URLSearchParams("?utm_source=fb")), null);
});

// ---------------------------------------------------------------------------
// 4. The first ?ref= wins: a later link never reassigns an existing visitor.
//    (The rule proxy.ts applies — asserted here on its two inputs.)
// ---------------------------------------------------------------------------
test("an existing referral cookie is never overwritten by a later link", () => {
  function decide(url: string, cookies: Record<string, string>): string | null {
    const code = normalizeReferralCode(new URL(url).searchParams.get("ref"));
    if (!code || REF_COOKIE in cookies) return null; // null = leave the cookie alone
    return code;
  }

  assert.equal(decide("https://reseta.ph/?ref=first1", {}), "FIRST1");
  assert.equal(
    decide("https://reseta.ph/?ref=second2", { [REF_COOKIE]: "FIRST1" }),
    null,
    "a second agent's link does not take the customer from the first",
  );
  assert.equal(decide("https://reseta.ph/pricing", {}), null);
  assert.equal(decide("https://reseta.ph/?ref=!!", {}), null);
});

// ---------------------------------------------------------------------------
// 5. The event envelope is what the portal expects.
// ---------------------------------------------------------------------------
test("events carry a permanent account id, never an email or business name", () => {
  const orgId = "3f1a7f1e-0b6e-4f3a-9a71-6a9f0d2b4c55";
  const signedUp = {
    event_id: "evt_00000000-0000-4000-8000-000000000000",
    type: "customer.signed_up",
    occurred_at: "2026-10-07T12:00:00Z",
    data: {
      external_customer_id: orgId,
      business_name: "Botica de Batulusa",
      owner_name: "A. Dela Cruz",
      owner_phone: "09171234567",
      agent_code: "ZEN9X1",
      plan: "starter",
    },
  };
  const parsed = productEventSchema.safeParse(signedUp);
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues));
  assert.equal(parsed.data.data.external_customer_id, orgId);

  // The identifier has to be the account id. An email is not stable: the owner
  // can change it, and it would re-attribute or orphan the customer.
  assert.notEqual(signedUp.data.external_customer_id, "owner@example.com");

  // A monthly payment without the month it covers is not a valid event.
  assert.equal(
    productEventSchema.safeParse({
      event_id: "evt_00000000-0000-4000-8000-000000000001",
      type: "payment.submitted",
      occurred_at: "2026-10-07T12:00:00Z",
      data: {
        external_customer_id: orgId,
        type: "monthly",
        months_covered: 1,
        amount: 80000,
        bank_reference: "BPI-55512",
      },
    }).success,
    false,
  );
  // With it, it is.
  assert.equal(
    productEventSchema.safeParse({
      event_id: "evt_00000000-0000-4000-8000-000000000002",
      type: "payment.submitted",
      occurred_at: "2026-10-07T12:00:00Z",
      data: {
        external_customer_id: orgId,
        type: "monthly",
        months_covered: 3,
        billing_month_start: "2026-11",
        amount: 240000,
        bank_reference: "BPI-55512",
        receipt_path: "receipts/2026/abc.jpg",
      },
    }).success,
    true,
  );
});

// ---------------------------------------------------------------------------
// 6. Per-customer ordering: a stuck event holds back only its own customer.
// ---------------------------------------------------------------------------
test("one customer's events go in order, and a stuck one blocks nobody else", () => {
  const past = "2026-10-07T11:00:00Z";
  const future = "2026-10-07T13:00:00Z";
  const orgA = "org-a";
  const orgB = "org-b";

  const { due, blocked } = nextPerCustomer(
    [
      // A's signup is due; A's later payment must wait for it.
      { id: "a1", organization_id: orgA, created_at: "2026-10-07T10:00:00Z", next_attempt_at: past },
      { id: "a2", organization_id: orgA, created_at: "2026-10-07T10:05:00Z", next_attempt_at: past },
      // B's oldest is backing off, so B sends nothing this tick.
      { id: "b1", organization_id: orgB, created_at: "2026-10-07T10:01:00Z", next_attempt_at: future },
      { id: "b2", organization_id: orgB, created_at: "2026-10-07T10:06:00Z", next_attempt_at: past },
    ],
    NOW,
  );

  assert.deepEqual(due, ["a1"], "only the oldest due event per customer");
  assert.equal(blocked, 3);

  // Once A's signup is delivered, A's payment is next.
  assert.deepEqual(
    nextPerCustomer(
      [{ id: "a2", organization_id: orgA, created_at: "2026-10-07T10:05:00Z", next_attempt_at: past }],
      NOW,
    ).due,
    ["a2"],
  );
  // An empty queue is not an error.
  assert.deepEqual(nextPerCustomer([], NOW), { due: [], blocked: 0 });
});

// ---------------------------------------------------------------------------
// 7. Delivery outcomes: what retries, what never will, and the backoff.
// ---------------------------------------------------------------------------
test("a portal outage retries and a refused event does not", async () => {
  const event = {
    event_id: "evt_00000000-0000-4000-8000-000000000003",
    type: "customer.reactivated" as const,
    occurred_at: "2026-10-07T12:00:00Z",
    data: { external_customer_id: "3f1a7f1e-0b6e-4f3a-9a71-6a9f0d2b4c55" },
  };
  const stub = (status: number, json: unknown) =>
    (async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;

  const ok = await deliverEvent(config, event, stub(200, { event_id: event.event_id, status: "processed" }));
  assert.equal(ok.kind, "delivered");

  // Already had it: done, stop sending.
  const dupe = await deliverEvent(config, event, stub(200, { event_id: event.event_id, status: "duplicate" }));
  assert.equal(dupe.kind, "delivered");

  // 422 can never be accepted as written.
  assert.equal((await deliverEvent(config, event, stub(422, { error: "bad data" }))).kind, "failed");
  // 500 and 401 are both worth retrying — a bad secret is fixed by config.
  assert.equal((await deliverEvent(config, event, stub(500, {}))).kind, "retry");
  assert.equal((await deliverEvent(config, event, stub(401, {}))).kind, "retry");
  // The portal being unreachable is a retry, not a failure.
  const down = await deliverEvent(config, event, (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch);
  assert.equal(down.kind, "retry");

  // Backoff grows and then stops growing, so a weekend outage is retried a
  // few times an hour at most.
  assert.equal(retryDelayMs(1), 30_000);
  assert.equal(retryDelayMs(2), 60_000);
  assert.equal(retryDelayMs(3), 120_000);
  assert.equal(retryDelayMs(40), 6 * 60 * 60 * 1000);
});

// ---------------------------------------------------------------------------
// 8. Callbacks: verified against the raw body, then parsed.
// ---------------------------------------------------------------------------
test("a callback is accepted only when signed for this product and this path", () => {
  const url = "https://reseta.ph/api/portal/callback";
  const callback = {
    event_id: "cb_00000000-0000-4000-8000-000000000000",
    type: "contract.signed",
    occurred_at: "2026-10-07T12:00:00Z",
    data: {
      external_customer_id: "3f1a7f1e-0b6e-4f3a-9a71-6a9f0d2b4c55",
      contract_id: "ct_1",
      signed_at: "2026-10-07T11:59:00Z",
      minimum_term_ends_at: "2027-10-07T11:59:00Z",
    },
  };
  const rawBody = JSON.stringify(callback);
  const sign = (pathname: string, slug = config.productSlug) =>
    new Headers({
      ...signedHeaders({
        productSlug: slug,
        secret: config.secret,
        method: "POST",
        pathname,
        rawBody,
        now: NOW,
      }),
    });

  const good = verifyCallback(
    config,
    { method: "POST", url, headers: sign("/api/portal/callback") },
    rawBody,
    NOW,
  );
  assert.ok(good.ok);
  assert.equal(good.callback.type, "contract.signed");

  // Signed for a different path, then presented here.
  const wrongPath = verifyCallback(
    config,
    { method: "POST", url, headers: sign("/api/v1/events") },
    rawBody,
    NOW,
  );
  assert.equal(wrongPath.ok, false);
  assert.equal(wrongPath.ok === false && wrongPath.status, 401);

  // Signed for another product on the portal.
  const wrongProduct = verifyCallback(
    config,
    { method: "POST", url, headers: sign("/api/portal/callback", "servd") },
    rawBody,
    NOW,
  );
  assert.equal(wrongProduct.ok, false);
  assert.equal(wrongProduct.ok === false && wrongProduct.status, 401);

  // Correctly signed but not a callback shape we know.
  const nonsense = JSON.stringify({ event_id: "cb_2", type: "payment.levitated" });
  const badShape = verifyCallback(
    config,
    {
      method: "POST",
      url,
      headers: new Headers({
        ...signedHeaders({
          productSlug: config.productSlug,
          secret: config.secret,
          method: "POST",
          pathname: "/api/portal/callback",
          rawBody: nonsense,
          now: NOW,
        }),
      }),
    },
    nonsense,
    NOW,
  );
  assert.equal(badShape.ok, false);
  assert.equal(badShape.ok === false && badShape.status, 422);
});

// ---------------------------------------------------------------------------
// 9. A payment confirmation says which payment, by bank reference.
// ---------------------------------------------------------------------------
test("payment callbacks are matched by bank reference", () => {
  const confirmed = portalCallbackSchema.safeParse({
    event_id: "cb_00000000-0000-4000-8000-000000000001",
    type: "payment.confirmed",
    occurred_at: "2026-10-07T12:00:00Z",
    data: {
      external_customer_id: "3f1a7f1e-0b6e-4f3a-9a71-6a9f0d2b4c55",
      bank_reference: "BPI-55512",
      payment_type: "monthly",
      months_covered: 1,
      billing_month_start: "2026-11",
      amount: 80000,
    },
  });
  assert.ok(confirmed.success, confirmed.success ? "" : JSON.stringify(confirmed.error.issues));
  assert.equal(
    confirmed.data.type === "payment.confirmed" && confirmed.data.data.bank_reference,
    "BPI-55512",
  );

  // An activation confirmation carries no month.
  assert.ok(
    portalCallbackSchema.safeParse({
      event_id: "cb_00000000-0000-4000-8000-000000000002",
      type: "payment.confirmed",
      occurred_at: "2026-10-07T12:00:00Z",
      data: {
        external_customer_id: "3f1a7f1e-0b6e-4f3a-9a71-6a9f0d2b4c55",
        bank_reference: "BPI-55513",
        payment_type: "activation",
        months_covered: 1,
        billing_month_start: null,
        amount: 500000,
      },
    }).success,
  );

  // A rejection has to say why — it is shown to the owner.
  assert.equal(
    portalCallbackSchema.safeParse({
      event_id: "cb_00000000-0000-4000-8000-000000000003",
      type: "payment.rejected",
      occurred_at: "2026-10-07T12:00:00Z",
      data: {
        external_customer_id: "3f1a7f1e-0b6e-4f3a-9a71-6a9f0d2b4c55",
        bank_reference: "BPI-55514",
      },
    }).success,
    false,
  );
});

// ---------------------------------------------------------------------------
// 10. The receipt form: a bank reference is required, and coverage is counted
//     from confirmed payments only.
// ---------------------------------------------------------------------------
test("a receipt needs a bank reference, and coverage counts confirmed months once", () => {
  const complete = parseReceiptForm({
    type: "monthly",
    amount: "800",
    bank_reference: "BPI-55512",
    months_covered: "3",
    billing_month_start: "2026-11",
  });
  assert.ok(complete.ok);
  assert.equal(complete.input.amount, 80000, "pesos are stored as centavos");
  assert.equal(complete.input.bankReference, "BPI-55512");

  // No reference, or one too short to be one.
  const noRef = parseReceiptForm({
    type: "monthly",
    amount: "800",
    months_covered: "1",
    billing_month_start: "2026-11",
  });
  assert.equal(noRef.ok, false);
  assert.match(noRef.ok === false ? noRef.error : "", /bank reference/i);

  // An activation covers exactly one activation, never a month.
  const activation = parseReceiptForm({
    type: "activation",
    amount: "5,000.00",
    bank_reference: "BPI-900",
  });
  assert.ok(activation.ok);
  assert.equal(activation.input.monthsCovered, 1);
  assert.equal(activation.input.billingMonth, null);
  assert.equal(activation.input.amount, 500000);

  // Two receipts for the same month cover it once, not twice.
  const until = coverageEnd([
    { billingMonthStart: new Date("2026-11-01T00:00:00Z"), monthsCovered: 1 },
    { billingMonthStart: new Date("2026-11-01T00:00:00Z"), monthsCovered: 1 },
  ]);
  assert.equal(until?.toISOString(), new Date("2026-12-01T00:00:00+08:00").toISOString());

  // Three months from November runs to February.
  const threeMonths = coverageEnd([
    { billingMonthStart: new Date("2026-11-01T00:00:00Z"), monthsCovered: 3 },
  ]);
  assert.equal(threeMonths?.toISOString(), new Date("2027-02-01T00:00:00+08:00").toISOString());

  // Nothing confirmed yet: the form suggests the current Manila month.
  assert.equal(coverageEnd([]), null);
  assert.equal(nextBillingMonth(null, new Date("2026-10-07T12:00:00Z")), "2026-10");
  // Paid up to February: that is what to suggest next.
  assert.equal(
    nextBillingMonth(new Date("2027-02-01T00:00:00+08:00"), new Date("2026-10-07T12:00:00Z")),
    "2027-02",
  );
});

// ---------------------------------------------------------------------------
// 11. The portal's callback and the cron worker must not be sent to /sign-in.
//
//     They carry no session and never will. This was a live bug: the proxy's
//     coarse auth gate matched /api/* and 307'd every callback to the sign-in
//     page, so nothing reached the handler.
// ---------------------------------------------------------------------------
test("machine endpoints bypass the proxy's auth gate", async () => {
  const source = await readFile(new URL("../lib/supabase/middleware.ts", import.meta.url), "utf8");
  const [, machine] = source.match(/const MACHINE_PATHS = \[([^\]]+)\]/) ?? [];
  assert.ok(machine, "MACHINE_PATHS must exist in the proxy's session helper");
  const paths = [...machine.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

  for (const endpoint of ["/api/portal/callback", "/api/cron/portal-outbox"]) {
    assert.ok(
      paths.some((p) => endpoint === p || endpoint.startsWith(`${p}/`)),
      `${endpoint} would be redirected to /sign-in`,
    );
  }
  // A browser route must NOT be opened up by the same list.
  assert.equal(
    paths.some((p) => "/dashboard" === p || "/dashboard".startsWith(`${p}/`)),
    false,
  );
  // The gate itself has to consult the list, not just declare it.
  assert.match(source, /MACHINE_PATHS\.some/);
});

// ---------------------------------------------------------------------------
// 12. Confirmed payments activate and extend — and a lapse never locks anyone
//     out. The authority is apply_paid_coverage() in Postgres; this pins the
//     rule the SQL implements, so a change to one without the other is loud.
// ---------------------------------------------------------------------------
test("entitlement follows live coverage, and a lapse does not suspend", () => {
  // Mirrors apply_paid_coverage(): entitled when coverage is live, or when the
  // pharmacy is newly activated and has not started monthly billing yet.
  function entitlement(opts: { activationConfirmed: boolean; paidUntil: Date | null }, now: Date) {
    const covered = opts.paidUntil !== null && opts.paidUntil > now;
    const entitled = covered || (opts.paidUntil === null && opts.activationConfirmed);
    return { entitled, status: entitled ? "active" : "past_due" };
  }

  const now = new Date("2026-10-07T12:00:00Z");
  const future = new Date("2027-01-01T00:00:00+08:00");
  const past = new Date("2026-02-01T00:00:00+08:00");

  // Just activated, first month not yet paid — they are in.
  assert.deepEqual(entitlement({ activationConfirmed: true, paidUntil: null }, now), {
    entitled: true,
    status: "active",
  });
  // Paid through January.
  assert.deepEqual(entitlement({ activationConfirmed: true, paidUntil: future }, now), {
    entitled: true,
    status: "active",
  });
  // Coverage ran out in February. Having paid the one-time activation fee back
  // then is not a paid-up subscription today.
  assert.deepEqual(entitlement({ activationConfirmed: true, paidUntil: past }, now), {
    entitled: false,
    status: "past_due",
  });
  // Never paid anything.
  assert.deepEqual(entitlement({ activationConfirmed: false, paidUntil: null }, now), {
    entitled: false,
    status: "past_due",
  });

  // The SQL must only ever lift a suspension, never impose one: there is no
  // path from a lapse to status = 'suspended'.
  const sql = readFileSync(
    new URL("../supabase/migrations/20260711020000_portal_activation.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /when status = 'suspended' and v_entitled then 'active'/);
  assert.equal(
    /then\s+'suspended'/.test(sql),
    false,
    "a confirmed-payment callback must never suspend an account",
  );
});

// ---------------------------------------------------------------------------
// 13. Seven-day grace before suspension — and the sweep can only ever reach
//     accounts that went through the agent-portal billing flow.
// ---------------------------------------------------------------------------
test("suspension waits out the grace period and cannot touch other accounts", () => {
  const lapsed = new Date("2026-10-01T00:00:00+08:00");
  assert.equal(GRACE_DAYS, 7);
  assert.equal(
    suspendsAt(lapsed).toISOString(),
    new Date("2026-10-08T00:00:00+08:00").toISOString(),
  );

  // The rule the sweep applies: suspend only once now() is past the grace end.
  const due = (now: Date) => now > suspendsAt(lapsed);
  assert.equal(due(new Date("2026-10-07T23:59:00+08:00")), false, "day 6 is still open");
  assert.equal(due(new Date("2026-10-08T00:00:01+08:00")), true, "day 7 suspends");

  const sql = readFileSync(
    new URL("../supabase/migrations/20260711030000_suspend_lapsed.sql", import.meta.url),
    "utf8",
  );
  // Scope: an account with no agent code has no coverage and must be invisible
  // to the sweep, and a null coverage end must never be treated as lapsed.
  assert.match(sql, /o\.agent_code is not null/);
  assert.match(sql, /c\.paid_until is not null/);
  // Suspending must go through set_organization_status so the status change and
  // the customer.cancelled event are written together.
  assert.match(sql, /set_organization_status\(v_org, 'suspended'/);
  // And being let back in must tell the portal too.
  assert.match(sql, /set_organization_status\(p_org, 'active'\)/);
});
