"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createServiceClient } from "@/lib/supabase/service";
import { requirePlatformAdmin } from "@/lib/admin/auth";

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

export async function setOrgStatus(input: z.input<typeof statusSchema>): Promise<AdminResult> {
  await requirePlatformAdmin();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { orgId, status } = parsed.data;

  const db = createServiceClient();
  const { error } = await db.from("organizations").update({ status }).eq("id", orgId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
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
