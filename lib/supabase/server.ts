/**
 * Server-side Supabase client (anon key + user session, subject to RLS).
 *
 * Use this in Server Components, Route Handlers, and Server Actions for any
 * read/write that should be scoped to the signed-in user's organization. RLS
 * policies enforce tenant isolation; this client respects them.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component. This can be ignored
            // when middleware is refreshing sessions (see lib/supabase/middleware.ts).
          }
        },
      },
    },
  );
}
