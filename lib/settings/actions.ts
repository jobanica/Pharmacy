"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { inviteSchema } from "@/lib/validation/auth";
import type { UserRole } from "@/lib/supabase/types";

export type ActionState = { error: string } | { ok: true } | null;

const INVITE_TTL_DAYS = 7;

/** Owner/manager invites a teammate by email + role. */
export async function createInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) {
    return { error: "You do not have permission to invite members" };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid invite" };
  }

  const rawBranch = formData.get("branch_id");
  const branchId = typeof rawBranch === "string" && rawBranch ? rawBranch : null;

  const supabase = await createClient();
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from("invitations").insert({
    organization_id: ctx.organization.id,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role as UserRole,
    branch_id: branchId,
    token,
    expires_at: expiresAt,
    invited_by: ctx.user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "There is already a pending invite for that email" };
    }
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/** Owner/manager revokes a pending invitation. */
export async function revokeInviteAction(formData: FormData): Promise<void> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) return;

  const id = formData.get("id");
  if (typeof id !== "string") return;

  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", id);
  revalidatePath("/settings");
}
