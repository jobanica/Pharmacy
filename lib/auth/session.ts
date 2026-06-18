import "server-only";

/**
 * App context resolution — who the user is, their organization, role, and the
 * branches they can access (plus the active branch). Resolved from Supabase
 * Auth + the memberships/branches tables, scoped automatically by RLS.
 *
 * Branch access (Section 6):
 *   - owner / manager: all branches in the org
 *   - pharmacist / cashier: their assigned (default) branch only
 *
 * The active branch is persisted in the `active_branch` cookie and validated
 * against the accessible set on every load.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";

export const ACTIVE_BRANCH_COOKIE = "active_branch";

export type BranchSummary = {
  id: string;
  name: string;
};

export type AppContext = {
  user: { id: string; fullName: string; email: string };
  organization: { id: string; name: string };
  role: Role;
  branches: BranchSummary[];
  activeBranchId: string;
};

/**
 * Returns the signed-in user's app context, or `null` when unauthenticated or
 * not yet attached to an organization (e.g. an invited user who hasn't accepted).
 */
export async function getAppContext(): Promise<AppContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select(
      "role, default_branch_id, organization_id, organizations(id, name)",
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !membership.organizations) return null;

  const role = membership.role as Role;
  const org = membership.organizations as unknown as {
    id: string;
    name: string;
  };

  // RLS already restricts branches to the caller's org.
  let branchQuery = supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  // Pharmacists/cashiers are limited to their assigned branch.
  if (
    (role === "pharmacist" || role === "cashier") &&
    membership.default_branch_id
  ) {
    branchQuery = branchQuery.eq("id", membership.default_branch_id);
  }

  const { data: branches } = await branchQuery;
  const accessible: BranchSummary[] = branches ?? [];

  if (accessible.length === 0) return null;

  const cookieStore = await cookies();
  const cookieBranch = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value;
  const activeBranchId =
    accessible.find((b) => b.id === cookieBranch)?.id ??
    accessible.find((b) => b.id === membership.default_branch_id)?.id ??
    accessible[0].id;

  return {
    user: {
      id: user.id,
      fullName:
        (user.user_metadata?.full_name as string | undefined) ||
        user.email ||
        "User",
      email: user.email ?? "",
    },
    organization: { id: org.id, name: org.name },
    role,
    branches: accessible,
    activeBranchId,
  };
}

/**
 * Like {@link getAppContext} but redirects to sign-in when there is no context.
 * Use in the app shell layout and any authed Server Component.
 */
export async function requireAppContext(): Promise<AppContext> {
  const ctx = await getAppContext();
  if (!ctx) redirect("/sign-in");
  return ctx;
}
