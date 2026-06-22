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
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  orgName: z.string().min(1),
  plan: z.enum(["free", "starter", "pro"]).default("free"),
});

export type CreateAccountResult = { ok: true; orgId: string } | { error: string };

export async function createAccount(
  input: z.input<typeof createAccountSchema>,
): Promise<CreateAccountResult> {
  await requirePlatformAdmin();
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, fullName, orgName, plan } = parsed.data;

  const db = createServiceClient();

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError) return { error: authError.message };
  const userId = authData.user.id;

  await db.from("profiles").upsert({ id: userId, full_name: fullName });

  const slug =
    orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) +
    "-" +
    Math.random().toString(36).slice(2, 6);

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

  revalidatePath("/admin/subscriptions");
  return { ok: true, orgId: org.id };
}
