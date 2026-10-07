import { NextResponse } from "next/server";

import { verifyCallback } from "@/lib/agent-kit";
import { portalConfig } from "@/lib/portal/config";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/portal/callback — what the agent portal tells Reseta.
 *
 * Register this URL with the portal as this product's callback:
 *
 *     https://<your-host>/api/portal/callback
 *
 * The portal signs it with the same secret Reseta signs its own events with,
 * so the signature is checked against the RAW body text: re-serializing the
 * JSON would change key order and whitespace and reject a genuine request.
 *
 * Delivery is at-least-once. product_callback_inbox is the dedupe key, and
 * apply_portal_callback() inserts it in the same transaction as the change it
 * makes, so a replay is a no-op. Duplicates answer 200 — an error would make
 * the portal keep retrying something it has already delivered.
 */
export async function POST(request: Request) {
  const config = portalConfig();
  // No secret configured: nothing can be verified, so nothing is trusted.
  if (!config) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // Raw text, before any parsing. The signature covers these exact bytes.
  const rawBody = await request.text();

  const verified = verifyCallback(
    config,
    { method: request.method, url: request.url, headers: request.headers },
    rawBody,
  );
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  const { callback } = verified;
  const db = createServiceClient();
  const { data, error } = await db.rpc("apply_portal_callback", {
    p_event_id: callback.event_id,
    p_type: callback.type,
    p_payload: JSON.parse(rawBody),
  });

  // A failure here is ours, not the portal's: 500 so it retries.
  if (error) {
    return NextResponse.json({ error: "could_not_apply" }, { status: 500 });
  }

  const outcome = (data as { outcome?: string } | null)?.outcome ?? "applied";
  return NextResponse.json({ ok: true, outcome });
}
