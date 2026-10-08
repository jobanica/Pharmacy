import { headers } from "next/headers";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getPlatformBillingStatus } from "@/lib/billing/platform-config";
import { getCollectionDetails } from "@/lib/billing/collection";
import { PaymentsForm } from "@/components/admin/payments-form";
import { CollectionSettings } from "@/components/admin/collection-settings";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requirePlatformAdmin();
  const [status, collection] = await Promise.all([
    getPlatformBillingStatus(),
    getCollectionDetails(),
  ]);

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const webhookUrl = host ? `${proto}://${host}/api/webhooks/xendit` : "/api/webhooks/xendit";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Where subscribers send their payments, and the Xendit connection.
        </p>
      </div>
      <CollectionSettings details={collection} />
      <PaymentsForm
        enabled={status.enabled}
        hasSecretKey={status.hasSecretKey}
        hasWebhookToken={status.hasWebhookToken}
        webhookUrl={webhookUrl}
      />
    </div>
  );
}
