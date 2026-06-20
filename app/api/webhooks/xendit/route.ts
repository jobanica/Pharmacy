import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Xendit webhook handler (scaffold). Verifies the callback token and updates the
 * org's subscription. Inert until XENDIT_WEBHOOK_TOKEN is configured. Uses the
 * service-role client because webhooks have no user session (RLS would block).
 */
export async function POST(request: NextRequest) {
  const token = serverEnv().XENDIT_WEBHOOK_TOKEN;
  if (!token) {
    // Billing not configured — acknowledge so Xendit stops retrying.
    return NextResponse.json({ received: true, handled: false });
  }

  if (request.headers.get("x-callback-token") !== token) {
    return NextResponse.json({ error: "Invalid callback token" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const metadata = (payload.metadata ?? {}) as { organization_id?: string; plan?: string };
  const organizationId = metadata.organization_id;
  const status = typeof payload.status === "string" ? payload.status.toLowerCase() : undefined;

  if (organizationId && (status === "paid" || status === "settled")) {
    const supabase = createServiceClient();
    await supabase
      .from("subscriptions")
      .update({
        plan: metadata.plan ?? "starter",
        status: "active",
        xendit_subscription_id: (payload.id as string) ?? null,
      })
      .eq("organization_id", organizationId);
  }

  return NextResponse.json({ received: true });
}
