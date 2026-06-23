import { headers } from "next/headers";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getPlatformBillingStatus } from "@/lib/billing/platform-config";
import { PaymentsForm } from "@/components/admin/payments-form";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requirePlatformAdmin();
  const status = await getPlatformBillingStatus();

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const webhookUrl = host ? `${proto}://${host}/api/webhooks/xendit` : "/api/webhooks/xendit";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Connect Xendit to charge pharmacies for their subscriptions.
        </p>
      </div>
      <PaymentsForm
        enabled={status.enabled}
        hasSecretKey={status.hasSecretKey}
        hasWebhookToken={status.hasWebhookToken}
        webhookUrl={webhookUrl}
      />
    </div>
  );
}
