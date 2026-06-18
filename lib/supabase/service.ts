import "server-only";

/**
 * Service-role Supabase client — BYPASSES Row Level Security.
 *
 * ⚠️  Server-only. The `server-only` import above makes the build fail if this
 * module is ever imported into a Client Component. Use this ONLY for trusted,
 * tenant-aware operations where RLS cannot be relied upon, e.g.:
 *   - sign-up transaction (create org + branch + owner membership)
 *   - accepting invitations
 *   - PayMongo webhook handlers
 *
 * Every call site MUST scope queries to the correct organization_id itself,
 * because RLS will not do it for you here.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env";
import type { Database } from "./types";

export function createServiceClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
