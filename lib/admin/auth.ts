import "server-only";

/**
 * Platform super-admin resolution. A super-admin manages every subscriber
 * (organization) from /admin, independent of any per-org role.
 *
 * A user is a super-admin when EITHER:
 *   - their email is in the PLATFORM_ADMIN_EMAILS allowlist (zero-config), or
 *   - they have a row in public.platform_admins.
 *
 * Checks run server-side only.
 */
import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serverEnv } from "@/lib/env";

/** Bootstrap admin(s) so the dashboard works before any env var is set. */
const DEFAULT_ADMIN_EMAILS = ["john2caal@gmail.com"];

export type PlatformAdmin = { id: string; email: string };

function allowlistEmails(): string[] {
  const raw = serverEnv().PLATFORM_ADMIN_EMAILS ?? "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...fromEnv])];
}

/** The signed-in user if they are a platform super-admin, else null. */
export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const email = (user.email ?? "").toLowerCase();
  if (email && allowlistEmails().includes(email)) {
    return { id: user.id, email };
  }

  // Fall back to the platform_admins table (service role bypasses RLS).
  const admin = createServiceClient();
  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return data ? { id: user.id, email } : null;
});

/** Throws (redirects) when the caller is not a platform super-admin. */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/");
  return admin;
}
