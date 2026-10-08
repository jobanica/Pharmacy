# Connect a product to the CANVEXIA Agent Portal — build prompt

A single, self-contained prompt. It folds in every correction, decision and
trap found while doing this for Reseta, so a fresh agent can do it in one pass
instead of a dozen rounds of questions.

Fill in the four values in **Product** below and hand the whole thing over.

---

## Product

- **Product name:** Reseta
- **Product slug:** `reseta`
- **Portal base URL:** `https://canvexia-agent-portal.vercel.app`
- **Callback URL to register:** `https://<your-production-host>/api/portal/callback`

---

## What you are building

The Canvexia Agent Portal is a **separate system** that tracks sales agents, the
customers they refer, and the commission owed. This product reports what
happened and reacts to what the portal sends back.

**This product never calculates commission.** No commission amount, rate, tier
or formula may appear anywhere in this codebase. If you find yourself writing
one, you have misread the task.

Reporting direction:

| Direction | What |
|---|---|
| Product → portal | `customer.signed_up`, `payment.submitted`, `customer.cancelled`, `customer.reactivated` |
| Portal → product | `contract.signed`, `payment.confirmed`, `payment.rejected`, `payment.reversed` |

## Before writing any code

1. **Look for the portal's own source.** If `apps/agent-portal` exists in a
   sibling checkout, **its code is the source of truth over this document.**
   Read `packages/db/prisma/schema.prisma` and
   `apps/agent-portal/src/app/api/v1/*` and believe them over anything written
   here.
2. **Look for the connection kit** at `packages/core/src/agent-kit/`. If it
   exists, **use it rather than writing your own signing/validation.**
3. **The kit package is private and unpublished** (`@servd/core`, version
   `0.0.0`). You cannot `npm install` it. If this product lives in its own
   repository, **vendor the kit** — copy the files into `lib/agent-kit/` with a
   header comment saying where they came from and why.

## Constraints

- Match the existing stack, conventions and UI. **Do not add a framework or
  library without asking first.** (Reseta needed zero new dependencies.)
- **No payment gateway.** Payment is manual bank transfer plus an uploaded
  receipt.
- **Do not break existing customers.** Accounts with no agent code must behave
  exactly as they did before — no new events, no new UI, no behaviour change.
- Never commit real secret values. List the variables in `.env.example` only.

---

## Environment

```
AGENT_PORTAL_URL=https://canvexia-agent-portal.vercel.app
AGENT_PORTAL_PRODUCT_SLUG=reseta
AGENT_PORTAL_SECRET=            # server-only; issued once by the portal
CRON_SECRET=                    # guards the worker endpoint
```

All three `AGENT_PORTAL_*` must be present for anything to be sent. **When any
is missing the product must keep queueing events and send nothing** — never
throw, never fail a user request. Read them directly from `process.env`, not
through a validator that throws on absence.

If `.gitignore` has a blanket `.env*`, add `!.env.example` or the template will
never be committed.

---

## The portal contract — verified, not assumed

Everything in this section was checked against the portal's real code. Where an
earlier spec disagreed, this is correct.

### Signing (both directions, same scheme, same secret)

```
HMAC-SHA256( secret, `${timestamp}.${METHOD}.${pathname}.${rawBody}` ) → "sha256=<hex>"
```

| Header | Value |
|---|---|
| `x-canvexia-product` | the product slug |
| `x-canvexia-timestamp` | unix seconds |
| `x-canvexia-signature` | `sha256=<hex>` |

- Tolerance **±5 minutes**, rejected in *both* directions (a future timestamp is
  a replay at worst, a clock problem at best).
- The **query string is excluded** — proxies reorder and re-encode it.
- Verify against the **raw body text**. Never
  `JSON.stringify(JSON.parse(body))`: key order and whitespace do not survive
  the round trip and a genuine request will fail.
- Use `node:crypto` and `timingSafeEqual`, so this runs in route handlers, never
  in Edge middleware.

### Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/v1/codes/{code}` | `{ code, valid, active, agent_name }` |
| GET | `/api/v1/customers/{external_customer_id}` | `{ known, status, paid_months, activation_fee, monthly_fee, activation_confirmed, contract_signed }` |
| POST | `/api/v1/contracts/links` | `{ url, expires_at, already_signed }` |
| POST | `/api/v1/receipts` | `{ receipt_path }` — raw image bytes, `image/jpeg\|png\|webp`, max 4 MB |
| POST | `/api/v1/events` | `{ event_id, status, error? }` |

### Event envelope

```json
{ "event_id": "evt_<uuid>", "type": "...", "occurred_at": "<ISO8601 Z>", "data": { } }
```

**There is no `product` field in the body** — the product is identified by the
`x-canvexia-product` header.

`external_customer_id` is this product's **permanent account id** (the
organization/tenant UUID). Never an email or a business name: both are editable
and would re-attribute or orphan the customer.

### `POST /api/v1/events` responses

`status` is one of `processed | pending | duplicate | refused`.

**All four are successes — stop sending.** `pending` means accepted and waiting
on something (e.g. a payment for a customer whose signup has not arrived yet);
the portal retries it itself. `duplicate` means it already has it. `refused`
means recorded but will not be acted on.

### Retry policy

- **Permanent (never retry): 400, 404, 413, 422.**
- **401 is retryable** — a bad secret is fixed by configuration, and the queued
  events should flow once it is.
- Backoff `30s × 2^(n-1)`, capped at 6 hours.

### Event payloads

```
customer.signed_up   external_customer_id, business_name, owner_name,
                     owner_phone (REQUIRED, non-empty), agent_code, plan
payment.submitted    external_customer_id, type (activation|monthly),
                     months_covered, billing_month_start ("YYYY-MM", required
                     when monthly), amount (integer centavos), bank_reference,
                     receipt_path
customer.cancelled   external_customer_id, reason?
customer.reactivated external_customer_id
```

### Callback payloads

```
contract.signed    external_customer_id, contract_id, signed_at, minimum_term_ends_at
payment.confirmed  external_customer_id, bank_reference, payment_type,
                   months_covered, billing_month_start (nullable), amount
payment.rejected   external_customer_id, bank_reference, reason (REQUIRED)
payment.reversed   external_customer_id, bank_reference, reason (REQUIRED)
```

Callbacks are **at-least-once**. Dedupe on `event_id` and answer **200 for a
duplicate** — an error makes the portal keep retrying something it has already
delivered.

---

## Architecture — the rule that matters most

> **Never call the portal inside a user request.**

Write the event into an outbox table **in the same database transaction as the
business change**, and let a background worker deliver it. A portal outage then
shows up as a queue that drains late, never as a failed signup or a failed
receipt upload.

Do the transactional work in **database functions**, not in application code
with two awaited calls — that is not a transaction.

**Per-customer ordering.** A customer's events must reach the portal in the
order they happened (signup before any payment; cancelled before reactivated).
Each tick, take only the **oldest pending event per customer**, and only if it
is due. A row stuck retrying then holds back that one customer and nobody else.

---

## Database

**Accounts table** — add:
- `agent_code text` — nullable, set once at signup, **never editable afterwards**
  (enforce with a trigger that raises on change). Stored uppercase.
- `contract_status text` default `'unsigned'`, check `in ('unsigned','signed')`
- `contract_signed_at timestamptz`
- `contract_minimum_term_ends_at timestamptz`

**`product_event_outbox`** — `id, organization_id, event_id unique, type,
payload jsonb, status ('pending'|'sent'|'failed'), attempts, next_attempt_at,
last_status, last_error, portal_status, created_at, sent_at`. RLS on, no
policies (service role only). A `before insert` trigger keeps the stored
`event_id` and `payload->>'event_id'` identical.

**`product_callback_inbox`** — `event_id primary key, type, payload jsonb,
received_at, outcome`. RLS on, no policies. **No foreign key to accounts** — it
must be able to record a callback for a customer we do not recognise.

**`subscription_manual_payments`** — `id, organization_id, type
('activation'|'monthly'), months_covered, billing_month_start date,
amount_centavos, bank_reference text NOT NULL UNIQUE, receipt_path, status
('submitted'|'confirmed'|'rejected'|'reversed'), reason, submitted_by,
submitted_at, decided_at`. Members may `select` their own; all writes are
server-side.

**Platform settings** — a `payment_details jsonb` column holding the collection
QR path and the GCash / Maya / bank accounts (see *Where to pay*).

### Database functions

- `enqueue_product_event(org, type, data)` — **no-ops when the account has no
  agent code.** This single guard is what keeps existing customers untouched.
- `enqueue_customer_signed_up(org)` — idempotent, one signup event per account.
- `submit_manual_payment(...)` — inserts the payment row *and* queues
  `payment.submitted` together; refuses a duplicate bank reference; refuses an
  activation while the contract is unsigned or one is already submitted.
- `set_organization_status(org, status, reason)` — status change *and*
  `customer.cancelled` / `customer.reactivated` together.
- `apply_portal_callback(event_id, type, payload)` — dedupe, apply and record in
  one transaction.
- `paid_coverage_end(org)` / `apply_paid_coverage(org)` — see *Activation*.
- `suspend_lapsed_accounts(grace_days)` — see *Grace period*.

Extend the signup trigger (`handle_new_user` or equivalent) to read `agent_code`
from the signup metadata, write it onto the account, and call
`enqueue_customer_signed_up` — all inside the transaction that creates the
account. **Read the live function definition first and change only what you
must**; do not rewrite it from memory.

---

## Flows

### 1. Referral capture

In the proxy/middleware (runs on every route, so a visitor is attributed even if
they sign up days later from another page):

- Read `?ref=`, normalize (**uppercase, strip spaces and dashes**, must match
  `/^[A-Z0-9]{4,20}$/`; anything else is "no code", not an error).
- Store in cookie `cvx_ref`, **30 days, httpOnly, sameSite lax**.
- **Never overwrite an existing cookie** — the first agent's link wins; a later
  link must not take the customer from them.
- Must stay Edge-safe: import the referral helpers directly, not through a
  barrel that pulls in `node:crypto`.

### 2. Signup

- Referral field on the form, **prefilled and editable**. Read `?ref=` from the
  page's own search params *as well as* the cookie — the proxy sets the cookie
  on the response, so it is not readable on that same request.
- Collect the owner's **phone, required only when a referral code is present**
  (the portal requires a non-empty `owner_phone`).
- Validate the code server-side with `GET /api/v1/codes/{code}`. Drop it **only
  if the portal positively says it is not an active agent's**. No answer, a
  timeout, or no portal configured → **keep the code and continue**.
- **Signup must never fail because the portal is unreachable.**
- Clear the cookie once the code is recorded on the account.

### 3. Service agreement

Hosted by the portal. `POST /api/v1/contracts/links`, send the owner to the
returned URL. A null response means the portal has not processed the signup yet
— say "try again in a moment", do not error. The portal reports back with
`contract.signed`.

### 4. Where to pay

"Pay by bank transfer" is useless without saying where to. Add a **platform-wide**
collection block, editable by a super-admin: an uploaded **payment QR** plus
GCash / Maya / bank account details and a free-text note.

Show it on the billing page **once the agreement is signed and directly above
the receipt form** — the order the owner works in is sign → scan → pay → upload.
Show nothing until an admin has configured at least one method.

Name the amount due, read from `GET /api/v1/customers/{id}`
(`activation_fee` / `monthly_fee`). **Do not hard-code the fees or copy them
into this database** — they belong to the commission rule the customer signed up
under, and a local copy goes quietly stale. Prefill the amount field with it,
still editable: the owner types what they actually sent.

### 5. Receipt submission

- **Bank reference is required** and **globally unique** — the same reference
  twice is the same payment twice. Refuse it with a sentence, not a constraint
  error.
- Upload the image to **the portal's** storage (`POST /api/v1/receipts`) and
  store only the returned `receipt_path`. Do not keep a second copy.
- Unlike signup, this one *is* synchronous — "try again" beats a receipt that
  silently never arrives.
- Then call `submit_manual_payment(...)`, which writes the row and queues the
  event together.
- Refuse an activation receipt while the contract is unsigned.

### 6. Callbacks — `POST /api/portal/callback`

Read the **raw body text first**, verify, then parse. Dedupe through the inbox
inside the same transaction as the change. Answer 200 for duplicates, 401 for a
bad signature, 503 when no secret is configured, 500 on an internal failure (so
the portal retries).

### 7. Activation and extension

- `payment.confirmed` + activation → unlock the account (set the paid plan) and
  **lift a suspension**.
- `payment.confirmed` + monthly → push paid coverage forward.
- **Recompute coverage from every confirmed payment rather than incrementing.**
  That makes a replayed callback a no-op and makes reversals correct for free —
  the reversed payment simply stops counting.
- **Overlapping months do not stack**: two receipts for November cover November
  once.
- Entitled when coverage is live, **or** when newly activated with no monthly
  payment confirmed yet. Once any monthly payment exists, coverage alone
  governs — having paid the one-time activation fee last January is not a
  paid-up subscription today.

### 8. Grace period and suspension

A lapse is driven by the clock, not by an event, so **sweep it on a schedule**.

- Coverage lapsed → `past_due` immediately, **nothing else**.
- **7 days later → suspend**, and report `customer.cancelled`.
- **Never downgrade the plan.** Never suspend from a callback — only from the
  sweep, which is time-based and cannot arrive out of order.
- Only accounts that have an agent code **and** a confirmed monthly payment are
  ever in scope. Verify this on real data before shipping.
- Paying again lifts the suspension **and sends `customer.reactivated`** — both
  directions must go through the same function, or the portal keeps believing a
  paying customer has churned and the agent's commission stays stopped.
- **Warn the owner before it happens**: name the date their account closes while
  they can still act on it.

### 9. Worker

A cron route, every minute, guarded by `CRON_SECRET` as a bearer token (skip the
guard when the variable is unset so local dev works). It runs the lapse sweep
first, then drains the outbox, so a `customer.cancelled` goes out on the same
tick. **A failing sweep must not stop the queue draining.**

### 10. Admin

- Agent code and agreement status per subscriber. Setting a code is
  **add-only** — the trigger refuses a change, and setting one from null queues
  `customer.signed_up` as if the customer had arrived with it.
  **Check the owner has a phone number first** and refuse with a clear sentence
  if not, or the event lands in the failed queue over an empty field.
- A page listing failed events with their error and a **Retry** button, plus
  pending/sent counts and the callback URL to register.

---

## Traps that cost real time

1. **The auth gate will swallow every callback.** If the proxy/middleware
   matches `/api/*` and redirects unauthenticated requests to the sign-in page,
   the portal's callbacks and the cron worker get a **307 to `/sign-in`** and
   never reach their handlers. The integration looks configured and does
   nothing. Put the machine endpoints (`/api/portal`, `/api/cron`,
   `/api/webhooks`) on a bypass list — they authenticate themselves. **Verify
   with a real unsigned POST against the deployed URL and assert you get 401,
   not 307.**
2. **zod 3 → zod 4.** The kit is zod 3. In zod 4 use `z.iso.datetime({ offset:
   true })` and `ctx.addIssue({ code: "custom", ... })`. Keep the wire format
   identical. Check the installed version before porting.
3. **`date + interval` yields a `timestamp`, not a `date`.** Converting a
   coverage end to a timezone-aware instant through string concatenation
   produces `"2027-01-01 00:00:00 00:00:00+08"` and throws. Use
   `timezone('Asia/Manila', (d + make_interval(months => n))::timestamp)`.
4. **`next/image` validates the host against `images.remotePatterns`.** For a QR
   from object storage, use a plain `<img>` (and keep its pixels unresampled).
5. **Server Components cannot pass functions as props to Client Components.**
   The build does not catch it; it crashes at runtime. Pass a rendered node, or
   wrap in a client component.
6. **Next.js 16 uses `proxy.ts`, not `middleware.ts`** (`export function
   proxy(request: NextRequest)`). Read the docs in `node_modules/next/dist/docs/`
   rather than relying on memory.
7. **PostgREST caps reads at 1000 rows** — paginate any unbounded scan.
8. **Do not leave test fixtures in a live database.** Once the credentials are
   real, a test row's queued event will be delivered to the production portal on
   the next tick. Use a disposable account and delete it in the same session.

---

## Tests

At least ten, using whatever the project already has. **If it has no test
framework, use the language runtime's built-in one — do not add a dependency.**
(For Node, `node:test` plus a small resolver hook for TypeScript path aliases is
enough.)

Cover: signature construction; replay, tampering and wrong-secret rejection;
referral normalization; the first-code-wins rule; the event envelope and the
permanent-id requirement; per-customer ordering; delivery outcomes and backoff;
callback verification and parsing; the duplicate bank reference; coverage math
including non-stacking months; the grace boundary at day 6 vs day 7; and an
assertion that the machine endpoints bypass the auth gate.

---

## When you are done, report

1. Every file changed and every migration applied.
2. The new environment variables.
3. **The callback URL to register with the portal.**
4. **Anything in the portal's real API that did not match this document.**
5. Anything you deliberately did not do, and why.
