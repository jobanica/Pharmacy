"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext, type AppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { canUseMultiBranch } from "@/lib/billing/plans";

export type BranchResult = { ok: true } | { error: string };

/** Owners on the Pro plan may add and manage additional branches. */
async function requireBranchManager(): Promise<
  { error: string } | { ctx: AppContext }
> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_org")) {
    return { error: "Only the owner can manage branches." as const };
  }
  if (!canUseMultiBranch(ctx.organization.plan)) {
    return { error: "Multiple branches require the Pro plan." as const };
  }
  return { ctx };
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required").max(80),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function createBranch(
  input: z.input<typeof createSchema>,
): Promise<BranchResult> {
  const guard = await requireBranchManager();
  if (!("ctx" in guard)) return guard;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, address, phone } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    organization_id: guard.ctx.organization.id,
    name,
    address: address || null,
    phone: phone || null,
    is_active: true,
  });
  if (error) return { error: error.message };

  revalidatePath("/settings/branches");
  revalidatePath("/", "layout");
  return { ok: true };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Branch name is required").max(80),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function updateBranch(
  input: z.input<typeof updateSchema>,
): Promise<BranchResult> {
  const guard = await requireBranchManager();
  if (!("ctx" in guard)) return guard;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, name, address, phone } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("branches")
    .update({ name, address: address || null, phone: phone || null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/settings/branches");
  revalidatePath("/", "layout");
  return { ok: true };
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

export async function setBranchActive(
  input: z.input<typeof toggleSchema>,
): Promise<BranchResult> {
  const guard = await requireBranchManager();
  if (!("ctx" in guard)) return guard;

  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, isActive } = parsed.data;

  const supabase = await createClient();

  // Never let the last active branch be archived — the org needs at least one.
  if (!isActive) {
    const { count } = await supabase
      .from("branches")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", guard.ctx.organization.id)
      .eq("is_active", true);
    if ((count ?? 0) <= 1) {
      return { error: "You must keep at least one active branch." };
    }
  }

  const { error } = await supabase
    .from("branches")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/settings/branches");
  revalidatePath("/", "layout");
  return { ok: true };
}
