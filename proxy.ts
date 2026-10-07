import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { isTenantHost } from "@/lib/store/host";
import {
  REF_COOKIE,
  REF_COOKIE_OPTIONS,
  normalizeReferralCode,
} from "@/lib/agent-kit/ref";

/**
 * Remember `?ref=CODE` for 30 days.
 *
 * Done here because the proxy sees every route: someone who lands on any page
 * from an agent's link is still attributed if they sign up a week later from
 * the home page. The first code wins — a later link never overwrites it, so an
 * agent cannot be swapped out from under a visitor who already arrived.
 *
 * Junk in ?ref= normalizes to null and is ignored rather than stored.
 */
function rememberReferral(request: NextRequest, response: NextResponse): NextResponse {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get("ref"));
  if (!code || request.cookies.has(REF_COOKIE)) return response;
  response.cookies.set({ name: REF_COOKIE, value: code, ...REF_COOKIE_OPTIONS });
  return response;
}

// Next.js 16 "proxy" convention (formerly "middleware"). Runs on every matched
// request to refresh the Supabase auth session before Server Components render,
// and to route tenant custom domains to their storefront.
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host");

  // A request arriving on a tenant's connected domain renders that org's
  // storefront. Internal storefront/asset paths pass through untouched.
  if (isTenantHost(host)) {
    const { pathname } = request.nextUrl;
    const passthrough =
      pathname.startsWith("/storefront") ||
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api");
    if (!passthrough) {
      const url = request.nextUrl.clone();
      url.pathname = "/storefront";
      return rememberReferral(request, NextResponse.rewrite(url));
    }
    return rememberReferral(request, NextResponse.next());
  }

  return rememberReferral(request, await updateSession(request));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static assets and image files.
     * Auth/session refresh runs everywhere else.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
