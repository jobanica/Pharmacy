"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

const deleteSchema = z.object({ id: z.string().uuid() });

/**
 * Permanently delete a branch. Only allowed when the branch has no sales or
 * stock history (deleting one with history would destroy records) — otherwise
 * the owner should archive it instead. Never delete the last branch.
 */
export async function deleteBranch(
  input: z.input<typeof deleteSchema>,
): Promise<BranchResult> {
  const guard = await requireBranchManager();
  if (!("ctx" in guard)) return guard;

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id } = parsed.data;
  const orgId = guard.ctx.organization.id;

  const db = createServiceClient();

  // Must belong to this org, and never delete the last branch.
  const { data: branch } = await db
    .from("branches")
    .select("id, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!branch || branch.organization_id !== orgId) {
    return { error: "Branch not found." };
  }
  const { count: branchCount } = await db
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  if ((branchCount ?? 0) <= 1) {
    return { error: "You must keep at least one branch." };
  }

  // Block deletion when the branch has real history (sales or stock batches).
  const [{ count: saleCount }, { count: batchCount }] = await Promise.all([
    db.from("sales").select("id", { count: "exact", head: true }).eq("branch_id", id),
    db.from("batches").select("id", { count: "exact", head: true }).eq("branch_id", id),
  ]);
  if ((saleCount ?? 0) > 0 || (batchCount ?? 0) > 0) {
    return {
      error:
        "This branch has sales or stock history and can't be deleted. Archive it instead to keep the records.",
    };
  }

  // Clear soft references so the delete doesn't trip a foreign key.
  await db.from("memberships").update({ default_branch_id: null }).eq("default_branch_id", id);
  await db.from("invitations").update({ branch_id: null }).eq("branch_id", id);
  await db.from("employees").update({ branch_id: null }).eq("branch_id", id);

  const { error } = await db.from("branches").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This branch is still referenced by other records. Archive it instead.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/branches");
  revalidatePath("/", "layout");
  return { ok: true };
}
