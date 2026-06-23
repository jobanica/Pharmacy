import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { isTenantHost } from "@/lib/store/host";

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
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  return updateSession(request);
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
