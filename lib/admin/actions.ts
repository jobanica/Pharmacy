"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { normalizeReferralCode } from "@/lib/agent-kit/ref";
import { requeueEvent } from "@/lib/portal/outbox";

export type AdminResult = { ok: true } | { error: string };

const planSchema = z.object({
  orgId: z.string().uuid(),
  plan: z.enum(["free", "starter", "pro"]),
});

/** Change a subscriber's plan. Keeps the subscriptions row in sync if present. */
export async function setOrgPlan(input: z.input<typeof planSchema>): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { orgId, plan } = parsed.data;

  const db = createServiceClient();
  const { error } = await db.from("organizations").update({ plan }).eq("id", orgId);
  if (error) return { error: error.message };

  await db.from("subscriptions").update({ plan }).eq("organization_id", orgId);

  revalidatePath("/admin");
  return { ok: true };
}

const planEditSchema = z.object({
  id: z.enum(["free", "starter", "pro"]),
  name: z.string().trim().min(1, "Name is required"),
  priceCentavos: z.number().int().min(0, "Price cannot be negative"),
  description: z.string().trim().default(""),
  features: z.array(z.string().trim().min(1)).default([]),
});

/** Edit a plan's display (name, price, description, features). */
export async function updatePlan(
  input: z.input<typeof planEditSchema>,
): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = planEditSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, name, priceCentavos, description, features } = parsed.data;

  const db = createServiceClient();
  const { error } = await db.from("plan_overrides").upsert({
    id,
    name,
    price_centavos: priceCentavos,
    description,
    features,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  // Reflect the change everywhere plans are shown.
  revalidatePath("/admin/plans");
  revalidatePath("/");
  revalidatePath("/settings/billing");
  return { ok: true };
}

const billingSchema = z.object({
  enabled: z.boolean(),
  // Omitted/empty => keep the stored value (so the secret never has to be
  // re-entered just to toggle the flag).
  secretKey: z.string().trim().optional(),
  webhookToken: z.string().trim().optional(),
});

/**
 * Super-admin: configure Xendit so the platform can charge subscribers.
 * Stored in the service-role-only platform_settings table.
 */
export async function updatePlatformBilling(
  input: z.input<typeof billingSchema>,
): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = billingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { enabled, secretKey, webhookToken } = parsed.data;

  const updates: {
    id: boolean;
    billing_enabled: boolean;
    updated_at: string;
    xendit_secret_key?: string;
    xendit_webhook_token?: string;
  } = { id: true, billing_enabled: enabled, updated_at: new Date().toISOString() };
  // Only overwrite a credential when a new value was actually entered.
  if (secretKey) updates.xendit_secret_key = secretKey;
  if (webhookToken) updates.xendit_webhook_token = webhookToken;

  const db = createServiceClient();
  const { error } = await db.from("platform_settings").upsert(updates);
  if (error) return { error: error.message };

  revalidatePath("/admin/payments");
  return { ok: true };
}

const statusSchema = z.object({
  orgId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

/**
 * Suspend or reactivate a subscriber.
 *
 * Goes through set_organization_status() so the status change and the matching
 * customer.cancelled / customer.reactivated event are written in one
 * transaction. For a pharmacy with no agent code the function queues nothing,
 * so this behaves exactly as it always has.
 */
export async function setOrgStatus(input: z.input<typeof statusSchema>): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { orgId, status } = parsed.data;

  const db = createServiceClient();
  const { error } = await db.rpc("set_organization_status", {
    p_org: orgId,
    p_status: status,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}

const agentCodeSchema = z.object({
  orgId: z.string().uuid(),
  code: z.string().trim().min(1, "Enter the agent's code"),
});

/**
 * Attach a referring agent to a pharmacy that signed up without a code —
 * someone who was referred but typed nothing, or was signed up by hand.
 *
 * Only ever an addition. The organizations_agent_code_guard trigger refuses to
 * change a code that is already set, and setting one from null queues
 * customer.signed_up in the same transaction, so the portal learns about the
 * customer as if they had arrived with the code.
 */
export async function setOrgAgentCode(
  input: z.input<typeof agentCodeSchema>,
): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = agentCodeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const code = normalizeReferralCode(parsed.data.code);
  if (!code) {
    return { error: "A code is 4–20 letters or digits." };
  }

  const db = createServiceClient();
  const { data: org } = await db
    .from("organizations")
    .select("agent_code")
    .eq("id", parsed.data.orgId)
    .maybeSingle();
  if (!org) return { error: "That pharmacy no longer exists." };
  if (org.agent_code) {
    return { error: `This pharmacy is already attributed to ${org.agent_code}.` };
  }

  // The portal requires the owner's mobile number on a signup. Checked here so
  // the admin gets a sentence they can act on, rather than an event that sits
  // in the failed queue because a field was empty.
  const { data: owner } = await db
    .from("memberships")
    .select("profiles(phone)")
    .eq("organization_id", parsed.data.orgId)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const phone = (owner as { profiles: { phone: string | null } | null } | null)?.profiles?.phone;
  if (!phone?.trim()) {
    return {
      error:
        "Add the owner's mobile number to their profile first — the agent portal needs it to record the referral.",
    };
  }

  const { error } = await db
    .from("organizations")
    .update({ agent_code: code })
    .eq("id", parsed.data.orgId);
  if (error) return { error: error.message };

  revalidatePath("/admin/subscriptions");
  return { ok: true };
}

const createAccountSchema = z.object({
  orgName: z.string().min(1),
  ownerName: z.string().min(1),
  plan: z.enum(["free", "starter", "pro"]).default("free"),
});

export type CreateAccountResult =
  | { ok: true; orgId: string; setupLink: string }
  | { error: string };

/**
 * Create a pharmacy account using only a username/org name.
 * The pharmacy owner uses the returned setup link to set their own email + password.
 */
export async function createAccount(
  input: z.input<typeof createAccountSchema>,
): Promise<CreateAccountResult> {
  await requirePlatformAdmin();
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { orgName, ownerName, plan } = parsed.data;

  const db = createServiceClient();

  const slug =
    orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) +
    "-" +
    Math.random().toString(36).slice(2, 6);

  // Placeholder email — signals "setup not yet complete".
  const placeholderEmail = `${slug}@placeholder.reseta.ph`;
  const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + "!1";

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: placeholderEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: ownerName, setup_pending: true },
  });
  if (authError) return { error: authError.message };
  const userId = authData.user.id;

  await db.from("profiles").upsert({ id: userId, full_name: ownerName });

  const { data: org, error: orgError } = await db
    .from("organizations")
    .insert({ name: orgName, slug, plan, status: "active" })
    .select("id")
    .single();
  if (orgError) return { error: orgError.message };

  await db.from("memberships").insert({
    organization_id: org.id,
    user_id: userId,
    role: "owner",
    status: "active",
  });

  await db.from("branches").insert({
    organization_id: org.id,
    name: orgName,
    is_active: true,
  });

  // Every new account gets a 30-day Pro trial automatically.
  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.from("subscriptions").insert({
    organization_id: org.id,
    plan: "pro",
    status: "trialing",
    trial_ends_at: trialEndsAt,
  });
  // Set org plan to pro so feature gates reflect the trial immediately.
  await db.from("organizations").update({ plan: "pro" }).eq("id", org.id);

  // Generate a one-time magic link so the pharmacy can log in without knowing the temp password.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: linkData, error: linkError } = await db.auth.admin.generateLink({
    type: "magiclink",
    email: placeholderEmail,
    options: { redirectTo: `${appUrl}/setup` },
  });
  if (linkError) return { error: `Account created but link failed: ${linkError.message}` };

  revalidatePath("/admin/subscriptions");
  return {
    ok: true,
    orgId: org.id,
    setupLink: (linkData as { properties?: { action_link?: string } }).properties?.action_link ?? appUrl,
  };
}

/**
 * Put a failed portal event back in the queue (the "Retry" button on
 * /admin/agent-portal). Clears the backoff so the next cron tick sends it.
 */
export async function retryPortalEvent(id: string): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Unknown event" };

  await requeueEvent(parsed.data);
  revalidatePath("/admin/agent-portal");
  return { ok: true };
}

const collectionSchema = z.object({
  gcash: z.object({ enabled: z.boolean(), name: z.string().trim().max(120), number: z.string().trim().max(60) }),
  maya: z.object({ enabled: z.boolean(), name: z.string().trim().max(120), number: z.string().trim().max(60) }),
  bank: z.object({
    enabled: z.boolean(),
    bankName: z.string().trim().max(120),
    name: z.string().trim().max(120),
    number: z.string().trim().max(60),
  }),
  note: z.string().trim().max(500),
});

/**
 * Super-admin: where subscribers send their activation and monthly payments.
 * Shown to a referred pharmacy once it has signed the service agreement.
 * Merged into payment_details so an uploaded QR survives an edit of the text.
 */
export async function updateCollectionDetails(
  input: z.input<typeof collectionSchema>,
): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = collectionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { gcash, maya, bank, note } = parsed.data;

  const db = createServiceClient();
  const { data: cur } = await db.from("platform_settings").select("payment_details").maybeSingle();
  const existing = (cur?.payment_details ?? {}) as Record<string, unknown>;

  const { error } = await db.from("platform_settings").upsert({
    id: true,
    updated_at: new Date().toISOString(),
    payment_details: {
      ...existing,
      gcash,
      maya,
      bank: { enabled: bank.enabled, bank_name: bank.bankName, name: bank.name, number: bank.number },
      note,
    } as Json,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/payments");
  revalidatePath("/settings/billing");
  return { ok: true };
}

/** Upload the payment QR shown to subscribers. Public bucket — it is a QR to scan. */
export async function uploadCollectionQr(dataUrl: string): Promise<AdminResult> {
  await requirePlatformAdmin();
  if (!dataUrl.startsWith("data:image/")) return { error: "Invalid image" };

  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const ext = mime.includes("png") ? "png" : mime.includes("svg") ? "svg" : "jpg";
  const bytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
  if (bytes.length === 0 || bytes.length > 2_000_000) return { error: "Image too large (max 2MB)" };

  const db = createServiceClient();
  const path = `platform/collection-qr-${Date.now()}.${ext}`;
  const { error: upErr } = await db.storage
    .from("branding")
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) return { error: upErr.message };

  const { data: cur } = await db.from("platform_settings").select("payment_details").maybeSingle();
  const existing = (cur?.payment_details ?? {}) as Record<string, unknown>;
  const { error } = await db.from("platform_settings").upsert({
    id: true,
    updated_at: new Date().toISOString(),
    payment_details: { ...existing, qr_path: path } as Json,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/payments");
  revalidatePath("/settings/billing");
  return { ok: true };
}

export async function removeCollectionQr(): Promise<AdminResult> {
  await requirePlatformAdmin();
  const db = createServiceClient();
  const { data: cur } = await db.from("platform_settings").select("payment_details").maybeSingle();
  const existing = { ...((cur?.payment_details ?? {}) as Record<string, unknown>) };
  delete existing.qr_path;

  const { error } = await db.from("platform_settings").upsert({
    id: true,
    updated_at: new Date().toISOString(),
    payment_details: existing as Json,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/payments");
  revalidatePath("/settings/billing");
  return { ok: true };
}
