import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LowStockTable, type LowStockRow } from "@/components/alerts/low-stock-table";
import { ExpiringTable, type ExpiringRow } from "@/components/alerts/expiring-table";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";

export default async function AlertsPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "manage_stock");
  const branchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  const [{ data: lowStock }, { data: expiring }] = await Promise.all([
    supabase
      .from("v_low_stock")
      .select("product_id, product_name, unit, on_hand, reorder_point, deficit")
      .eq("branch_id", ctx.activeBranchId)
      .order("deficit", { ascending: false }),
    supabase
      .from("v_expiring_batches")
      .select("batch_id, product_name, unit, batch_number, expiry_date, quantity, days_until, supplier_name")
      .eq("branch_id", ctx.activeBranchId)
      .order("days_until", { ascending: true }),
  ]);

  const lowRows = (lowStock ?? []) as LowStockRow[];
  const expRows = (expiring ?? []) as ExpiringRow[];

  return (
    <div>
      <PageHeader
        title="Alerts"
        description={`Low stock and expiring inventory for ${branchName}.`}
      />
      <Tabs defaultValue="low">
        <TabsList>
          <TabsTrigger value="low">Low stock ({lowRows.length})</TabsTrigger>
          <TabsTrigger value="expiring">Expiring ({expRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="low" className="mt-4">
          <LowStockTable rows={lowRows} branchName={branchName} canManage={canManage} />
        </TabsContent>
        <TabsContent value="expiring" className="mt-4">
          <ExpiringTable rows={expRows} branchName={branchName} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
