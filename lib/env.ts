/**
 * Centralized, validated environment access.
 *
 * Public (NEXT_PUBLIC_*) values are safe to read in the browser.
 * Server-only secrets (service role key, PayMongo keys) must NEVER be imported
 * into a client component — they are read lazily via `serverEnv()` so they are
 * not accidentally bundled for the browser.
 */
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Billing is feature-flagged OFF by default in dev (see Section 2.7).
  NEXT_PUBLIC_BILLING_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Reseta"),
});

const serverSchema = z.object({
  // Service role key — server-only, bypasses RLS. Guard its usage carefully.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Xendit (subscription scaffold). Optional in dev so the app boots without it.
  XENDIT_SECRET_KEY: z.string().optional(),
  XENDIT_WEBHOOK_TOKEN: z.string().optional(),
  // Anthropic (AI receipt scanner). Optional — the feature is flagged OFF when
  // the key is absent (see lib/ai/receipt.ts → aiReceiptEnabled()).
  ANTHROPIC_API_KEY: z.string().optional(),
  // Comma-separated emails granted platform super-admin access (/admin).
  // Optional; the platform_admins table is the other source of admins.
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
});

function readPublicEnv() {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_BILLING_ENABLED: process.env.NEXT_PUBLIC_BILLING_ENABLED,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}\nDid you copy .env.example to .env.local?`,
    );
  }
  return parsed.data;
}

export const publicEnv = readPublicEnv();

/**
 * Server-only secrets. Call this inside server code (Server Components, Route
 * Handlers, Server Actions). Throws if required secrets are missing.
 */
export function serverEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    XENDIT_SECRET_KEY: process.env.XENDIT_SECRET_KEY,
    XENDIT_WEBHOOK_TOKEN: process.env.XENDIT_WEBHOOK_TOKEN,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    PLATFORM_ADMIN_EMAILS: process.env.PLATFORM_ADMIN_EMAILS,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment variables:\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}
