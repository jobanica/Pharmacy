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

const PUBLIC_PATHS = ["/sign-in", "/sign-up", "/accept-invite", "/auth"];

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
  await supabase.auth.getUser();

  // NOTE (Milestone 2): the auth redirect gate below is intentionally disabled
  // until sign-in/sign-up are built, so the app shell is demoable in M1. Enable
  // it once auth lands by uncommenting and removing this note.
  //
  // const { pathname } = request.nextUrl;
  // const isPublic = PUBLIC_PATHS.some(
  //   (p) => pathname === p || pathname.startsWith(`${p}/`),
  // );
  // if (!user && !isPublic) {
  //   const url = request.nextUrl.clone();
  //   url.pathname = "/sign-in";
  //   url.searchParams.set("redirectTo", pathname);
  //   return NextResponse.redirect(url);
  // }
  void PUBLIC_PATHS;

  return supabaseResponse;
}
