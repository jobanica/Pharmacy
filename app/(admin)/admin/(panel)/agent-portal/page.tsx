import { headers } from "next/headers";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getPortalQueue } from "@/lib/admin/portal-data";
import { PortalQueueTable } from "@/components/admin/portal-queue-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { callbackUrl, portalConfigured } from "@/lib/portal/config";

export const dynamic = "force-dynamic";

export default async function AdminAgentPortalPage() {
  await requirePlatformAdmin();
  const [queue, h] = await Promise.all([getPortalQueue(), headers()]);

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const configured = portalConfigured();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Agent portal</h1>
        <p className="text-sm text-muted-foreground">
          What Reseta has reported to the agent portal, and anything that could
          not be delivered.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Connection
            <Badge variant={configured ? "default" : "outline"}>
              {configured ? "configured" : "not configured"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {configured
              ? "Events are delivered by the cron worker every minute."
              : "Set AGENT_PORTAL_URL, AGENT_PORTAL_PRODUCT_SLUG and AGENT_PORTAL_SECRET. Until then events keep queueing and are sent once configured — nothing is lost."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <div className="text-muted-foreground">Waiting to send</div>
            <div className="text-2xl font-semibold">{queue.pending}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Delivered</div>
            <div className="text-2xl font-semibold">{queue.sent}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Failed</div>
            <div className="text-2xl font-semibold">{queue.failed.length}</div>
          </div>
          {host ? (
            <div className="sm:col-span-3">
              <div className="text-muted-foreground">Callback URL to register with the portal</div>
              <code className="text-xs">{callbackUrl(host)}</code>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Failed events</h2>
        <PortalQueueTable failed={queue.failed} />
      </div>
    </div>
  );
}
