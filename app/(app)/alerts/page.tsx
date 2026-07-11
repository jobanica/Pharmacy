import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LowStockTable, type LowStockRow } from "@/components/alerts/low-stock-table";
import { ExpiringTable, type ExpiringRow } from "@/components/alerts/expiring-table";
import { StaleStockTable, type StaleRow } from "@/components/alerts/stale-stock-table";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { canUseInventory } from "@/lib/billing/plans";
import { PlanUpsell } from "@/components/billing/plan-upsell";

export default async function AlertsPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "manage_stock");

  if (!canUseInventory(ctx.organization.plan)) {
    return (
      <div className="grid gap-4">
        <PlanUpsell
          title="Expiry & Low-Stock Alerts"
          description="Get notified about medicines that are expiring soon or running low on stock. Available on the Starter plan and above."
        />
      </div>
    );
  }
  const branchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  const [{ data: lowStock }, { data: expiring }, { data: dead }, { data: slow }] = await Promise.all([
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
    supabase
      .from("v_dead_stock")
      .select("product_id, product_name, unit, on_hand, value_centavos, last_sold_at")
      .eq("branch_id", ctx.activeBranchId)
      .order("value_centavos", { ascending: false }),
    supabase
      .from("v_slow_moving")
      .select("product_id, product_name, unit, on_hand, sold_90d, days_of_supply, value_centavos, last_sold_at")
      .eq("branch_id", ctx.activeBranchId)
      .order("days_of_supply", { ascending: false }),
  ]);

  const lowRows = (lowStock ?? []) as LowStockRow[];
  const expRows = (expiring ?? []) as ExpiringRow[];
  const deadRows: StaleRow[] = (dead ?? []).map((r) => ({
    product_id: r.product_id,
    product_name: r.product_name,
    unit: r.unit,
    on_hand: r.on_hand,
    value_centavos: r.value_centavos,
    last_sold_at: r.last_sold_at,
    days_of_supply: null,
    sold_90d: null,
  }));
  const slowRows: StaleRow[] = (slow ?? []).map((r) => ({
    product_id: r.product_id,
    product_name: r.product_name,
    unit: r.unit,
    on_hand: r.on_hand,
    value_centavos: r.value_centavos,
    last_sold_at: r.last_sold_at,
    days_of_supply: r.days_of_supply,
    sold_90d: r.sold_90d,
  }));

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
          <TabsTrigger value="dead">Dead stock ({deadRows.length})</TabsTrigger>
          <TabsTrigger value="slow">Slow-moving ({slowRows.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="low" className="mt-4">
          <LowStockTable rows={lowRows} branchName={branchName} canManage={canManage} />
        </TabsContent>
        <TabsContent value="expiring" className="mt-4">
          <ExpiringTable rows={expRows} branchName={branchName} canManage={canManage} />
        </TabsContent>
        <TabsContent value="dead" className="mt-4">
          <StaleStockTable
            rows={deadRows}
            kind="dead"
            branchName={branchName}
            emptyMessage="No dead stock — every product in stock has sold in the last 90 days."
          />
        </TabsContent>
        <TabsContent value="slow" className="mt-4">
          <StaleStockTable
            rows={slowRows}
            kind="slow"
            branchName={branchName}
            emptyMessage="No slow-moving items — stock is turning over well."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
