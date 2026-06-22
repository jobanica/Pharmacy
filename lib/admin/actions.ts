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

  // Mirror onto the subscriptions row when one exists (ignored otherwise).
  await db.from("subscriptions").update({ plan }).eq("organization_id", orgId);

  revalidatePath("/admin");
  return { ok: true };
}

const statusSchema = z.object({
  orgId: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

/**
 * Activate or suspend a subscriber. A suspended org's storefront goes offline
 * (place_order checks status) and its members are blocked at sign-in.
 */
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
