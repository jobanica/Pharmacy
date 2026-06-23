import { publicEnv } from "@/lib/env";

/**
 * Decide whether an incoming request host belongs to the app itself or to a
 * tenant's connected custom domain.
 *
 * App hosts: localhost, *.vercel.app (previews/prod), and the configured
 * NEXT_PUBLIC_PRIMARY_HOST. Everything else is treated as a tenant storefront
 * domain — but ONLY when a primary host is configured, so an unconfigured
 * deployment never accidentally rewrites its own marketing domain.
 */
export function isTenantHost(rawHost: string | null | undefined): boolean {
  const primary = publicEnv.NEXT_PUBLIC_PRIMARY_HOST?.split(":")[0].toLowerCase();
  if (!primary) return false; // Feature disabled until a primary host is set.

  const host = (rawHost ?? "").split(":")[0].toLowerCase();
  if (!host) return false;

  if (host === primary) return false;
  if (host === "localhost" || host === "127.0.0.1") return false;
  if (host.endsWith(".vercel.app")) return false;

  return true;
}
