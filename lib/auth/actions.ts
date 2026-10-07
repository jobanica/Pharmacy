"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import {
  signInSchema,
  signUpSchema,
  acceptInviteSchema,
} from "@/lib/validation/auth";
import { ACTIVE_BRANCH_COOKIE } from "@/lib/auth/session";
import { lookupAgentCode } from "@/lib/agent-kit";
import { REF_COOKIE } from "@/lib/agent-kit/ref";
import { portalConfig } from "@/lib/portal/config";

export type ActionState = { error: string } | null;

/**
 * Self-serve sign-up. The `org_name`/`branch_name` metadata triggers
 * handle_new_user() in Postgres to create the org + first branch + owner
 * membership atomically — and, when an `agent_code` is present, to queue the
 * customer.signed_up event in that same transaction.
 *
 * The referral code is checked against the agent portal first, but only to
 * decide whether to keep it. A portal that is down, slow or not configured
 * yet reads as "can't tell", the code is kept as typed, and the signup goes
 * through: creating the account always wins over attributing it.
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
    referralCode: formData.get("referralCode") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid details" };
  }

  const agentCode = await resolveReferralCode(parsed.data.referralCode);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        org_name: parsed.data.organizationName,
        branch_name: parsed.data.branchName ?? "Main Branch",
        ...(parsed.data.phone ? { phone: parsed.data.phone } : {}),
        ...(agentCode ? { agent_code: agentCode } : {}),
      },
    },
  });
  if (error) return { error: error.message };

  // The code has been recorded on the organization; the cookie has done its job.
  if (agentCode) {
    const cookieStore = await cookies();
    cookieStore.delete(REF_COOKIE);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Which code (if any) to store on the new organization.
 *
 * A code the portal positively says is not an active agent's is dropped — it
 * is a typo, and storing it would attribute the customer to nobody while
 * being impossible to correct later. Everything else (no answer, no portal
 * configured, a network error) keeps the code: the portal is the authority on
 * whether to pay for it, and it can be reviewed there.
 */
async function resolveReferralCode(code: string | null): Promise<string | null> {
  if (!code) return null;
  const config = portalConfig();
  if (!config) return code;
  const lookup = await lookupAgentCode(config, code);
  if (lookup && (!lookup.valid || !lookup.active)) return null;
  return code;
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

  // Build an absolute origin from the request so the email link points back to
  // this deployment (the NEXT_PUBLIC_SITE_URL env var isn't configured here).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
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
