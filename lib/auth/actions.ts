"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  signInSchema,
  signUpSchema,
  acceptInviteSchema,
} from "@/lib/validation/auth";
import { ACTIVE_BRANCH_COOKIE } from "@/lib/auth/session";

export type ActionState = { error: string } | null;

/**
 * Self-serve sign-up. The `org_name`/`branch_name` metadata triggers
 * handle_new_user() in Postgres to create the org + first branch + owner
 * membership atomically.
 */
export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    organizationName: formData.get("organizationName"),
    branchName: formData.get("branchName") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        org_name: parsed.data.organizationName,
        branch_name: parsed.data.branchName ?? "Main Branch",
      },
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password" };

  const redirectTo = (formData.get("redirectTo") as string) || "/dashboard";
  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_BRANCH_COOKIE);
  revalidatePath("/", "layout");
  redirect("/sign-in");
}

/**
 * Accept an invitation: create the invited user's account (no org metadata, so
 * they don't bootstrap a new org), then attach them to the inviting org via the
 * accept_invitation RPC.
 */
export async function acceptInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = acceptInviteSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const supabase = await createClient();

  // Resolve the invite's email (the invited user cannot choose it).
  const { data: details, error: lookupError } = await supabase.rpc(
    "invitation_details",
    { invite_token: parsed.data.token },
  );
  if (lookupError) return { error: lookupError.message };
  const invite = details?.[0];
  if (!invite) return { error: "This invitation is invalid or has expired" };

  const { error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (signUpError) return { error: signUpError.message };

  const { error: acceptError } = await supabase.rpc("accept_invitation", {
    invite_token: parsed.data.token,
  });
  if (acceptError) return { error: acceptError.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** Send a password-reset email. */
export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState | { ok: true }> {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return { error: "Email is required" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/reset-password`,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Update password after clicking a reset link (user must have a valid session from the email). */
export async function updatePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState | { ok: true }> {
  const password = (formData.get("password") as string | null)?.trim() ?? "";
  const confirm = (formData.get("confirm") as string | null)?.trim() ?? "";
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };
  if (password !== confirm) return { error: "Passwords do not match" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Persist the active branch selection (validated in getAppContext). */
export async function setActiveBranchAction(branchId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
