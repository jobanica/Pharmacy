import { notFound } from "next/navigation";
import { CalendarX, PackageX, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { WriteOffDialog } from "@/components/inventory/write-off-dialog";
import {
  AdjustmentsCsvButton,
  type AdjustmentCsvRow,
} from "@/components/inventory/adjustments-csv-button";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { canUseInventory } from "@/lib/billing/plans";
import { PlanUpsell } from "@/components/billing/plan-upsell";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";

const REASON_LABEL: Record<string, string> = {
  expired: "Expired",
  damaged: "Damaged",
  other: "Other",
};

export default async function AdjustmentsPage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_stock")) notFound();

  if (!canUseInventory(ctx.organization.plan)) {
    return (
      <PlanUpsell
        title="Stock Adjustments"
        description="Write off expired and damaged stock and track the cost of losses. Available on the Starter plan and above."
      />
    );
  }

  const supabase = await createClient();
  const branchName = ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  const [products, { data: writeoffs }] = await Promise.all([
    fetchAllRows<{ id: string; name: string }>((from, to) =>
      supabase
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
        .order("id")
        .range(from, to),
    ),
    supabase
      .from("stock_writeoffs")
      .select("id, product_name, quantity, unit_cost_centavos, total_cost_centavos, reason, notes, created_at")
      .eq("branch_id", ctx.activeBranchId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rows = writeoffs ?? [];
  const csvRows: AdjustmentCsvRow[] = rows.map((r) => ({
    date: formatManila(r.created_at, "MMM d, yyyy h:mm a"),
    product: r.product_name ?? "",
    reason: REASON_LABEL[r.reason] ?? r.reason,
    quantity: r.quantity,
    unitCost: (r.unit_cost_centavos / 100).toFixed(2),
    totalCost: (r.total_cost_centavos / 100).toFixed(2),
    notes: r.notes ?? "",
  }));
  const expiredTotal = rows.filter((r) => r.reason === "expired").reduce((s, r) => s + r.total_cost_centavos, 0);
  const damagedTotal = rows.filter((r) => r.reason === "damaged").reduce((s, r) => s + r.total_cost_centavos, 0);
  const otherTotal = rows.filter((r) => r.reason === "other").reduce((s, r) => s + r.total_cost_centavos, 0);

  const cards = [
    { icon: CalendarX, label: "Expired — total cost", value: formatCentavos(expiredTotal), gradient: "from-amber-500 to-orange-600" },
    { icon: PackageX, label: "Damaged — total cost", value: formatCentavos(damagedTotal), gradient: "from-rose-500 to-red-600" },
    { icon: Trash2, label: "Other — total cost", value: formatCentavos(otherTotal), gradient: "from-slate-500 to-slate-700" },
  ];

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Stock Adjustments"
        description={`Write-offs for ${branchName}. Loss cost is tracked by reason.`}
        action={
          <div className="flex items-center gap-2">
            <AdjustmentsCsvButton rows={csvRows} />
            <WriteOffDialog
              products={products}
              trigger={
                <Button>
                  <Trash2 className="size-4" />
                  Record adjustment
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient} p-5 text-white shadow-lg`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/90">{c.label}</span>
                <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
                  <Icon className="size-5" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-bold">{c.value}</div>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit cost</th>
              <th className="px-3 py-2 text-right">Total cost</th>
              <th className="px-3 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{formatManila(r.created_at, "MMM d, yyyy h:mm a")}</td>
                  <td className="px-3 py-2 font-medium">{r.product_name ?? "—"}</td>
                  <td className="px-3 py-2">{REASON_LABEL[r.reason] ?? r.reason}</td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatCentavos(r.unit_cost_centavos)}</td>
                  <td className="px-3 py-2 text-right font-medium text-destructive">
                    {formatCentavos(r.total_cost_centavos)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="h-16 text-center text-muted-foreground">
                  No adjustments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
