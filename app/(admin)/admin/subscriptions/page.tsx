import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/data";
import { SubscribersTable } from "@/components/admin/subscribers-table";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await requirePlatformAdmin();
  const { subscribers } = await getAdminOverview();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          Manage every pharmacy — change plans, activate, or suspend.
        </p>
      </div>
      <SubscribersTable subscribers={subscribers} />
    </div>
  );
}
