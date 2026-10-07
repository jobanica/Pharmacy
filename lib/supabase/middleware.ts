/**
 * Session refresh for the Next.js middleware.
 *
 * Runs on every matched request: refreshes the Supabase auth cookie so Server
 * Components always see a valid session, and performs a coarse auth gate
 * (redirect unauthenticated users away from the app shell to sign-in).
 *
 * Fine-grained role/org checks live in Server Actions and route guards; this is
 * only the first line.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/accept-invite", "/auth", "/store", "/admin/login", "/forgot-password", "/reset-password"];

/**
 * Endpoints called by machines, not browsers: the agent portal's signed
 * callbacks, Vercel's cron invocations and the payment webhook.
 *
 * They must skip the coarse auth gate below. There is no session on these
 * requests and never will be, so redirecting them to /sign-in would silently
 * swallow every callback and every scheduled run. Each one authenticates
 * itself instead — a signature over the raw body, or a bearer token.
 *
 * Note this is only about the redirect. Other /api routes stay gated.
 */
const MACHINE_PATHS = ["/api/portal", "/api/cron", "/api/webhooks"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  // Refreshing here keeps the auth cookie valid for Server Components.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    MACHINE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
