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
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
import type { Json } from "@/lib/supabase/types";

export const ACTIVE_BRANCH_COOKIE = "active_branch";

export type BranchSummary = {
  id: string;
  name: string;
};

export type AppContext = {
  user: { id: string; fullName: string; email: string };
  organization: { id: string; name: string; plan: string; settings: Json };
  role: Role;
  branches: BranchSummary[];
  activeBranchId: string;
};

/**
 * Returns the signed-in user's app context, or `null` when unauthenticated or
 * not yet attached to an organization (e.g. an invited user who hasn't accepted).
 *
 * Wrapped in React `cache()` so the layout and page in a single request share
 * one resolution (one getUser + one membership/branches fetch) instead of
 * re-querying. Membership and branches run in parallel; both are RLS-scoped.
 */
export const getAppContext = cache(
  async (): Promise<AppContext | null> => {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: membership }, { data: branches }] = await Promise.all([
      supabase
        .from("memberships")
        .select("role, default_branch_id, organization_id, organizations(id, name, plan, settings)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
      // RLS already restricts branches to the caller's org.
      supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
    ]);

    if (!membership || !membership.organizations) return null;

    const role = membership.role as Role;
    const org = membership.organizations as unknown as {
      id: string;
      name: string;
      plan: string;
      settings: Json;
    };

    // Pharmacists/cashiers are limited to their assigned branch.
    const accessible: BranchSummary[] =
      (role === "pharmacist" || role === "cashier") && membership.default_branch_id
        ? (branches ?? []).filter((b) => b.id === membership.default_branch_id)
        : (branches ?? []);

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
    organization: { id: org.id, name: org.name, plan: org.plan, settings: org.settings },
    role,
    branches: accessible,
    activeBranchId,
  };
});

/**
 * Like {@link getAppContext} but redirects to sign-in when there is no context.
 * Use in the app shell layout and any authed Server Component.
 */
export async function requireAppContext(): Promise<AppContext> {
  const ctx = await getAppContext();
  if (!ctx) redirect("/sign-in");
  return ctx;
}
