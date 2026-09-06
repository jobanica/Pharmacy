import { notFound } from "next/navigation";
import { HeartHandshake } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DonationDialog } from "@/components/inventory/donation-dialog";
import {
  DonationsCsvButton,
  type DonationCsvRow,
} from "@/components/inventory/donations-csv-button";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { canUseInventory } from "@/lib/billing/plans";
import { PlanUpsell } from "@/components/billing/plan-upsell";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";

export default async function DonationsPage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_stock")) notFound();

  if (!canUseInventory(ctx.organization.plan)) {
    return (
      <PlanUpsell
        title="Donations"
        description="Record donated and given-away medicine and track its cost. Available on the Starter plan and above."
      />
    );
  }

  const supabase = await createClient();
  const branchName = ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  const [products, { data: donations }] = await Promise.all([
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
      .select("id, product_name, quantity, unit_cost_centavos, total_cost_centavos, notes, created_at")
      .eq("branch_id", ctx.activeBranchId)
      .eq("reason", "donated")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const rows = donations ?? [];
  const totalCost = rows.reduce((s, r) => s + r.total_cost_centavos, 0);
  const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);

  const csvRows: DonationCsvRow[] = rows.map((r) => ({
    date: formatManila(r.created_at, "MMM d, yyyy h:mm a"),
    product: r.product_name ?? "",
    quantity: r.quantity,
    cost: (r.total_cost_centavos / 100).toFixed(2),
    details: r.notes ?? "",
  }));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Donations"
        description={`Medicine donated / given away from ${branchName}.`}
        action={
          <div className="flex items-center gap-2">
            <DonationsCsvButton rows={csvRows} />
            <DonationDialog
              products={products}
              trigger={
                <Button>
                  <HeartHandshake className="size-4" />
                  Record donation
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white/90">Donated — total cost</span>
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
              <HeartHandshake className="size-5" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold">{formatCentavos(totalCost)}</div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border p-5">
          <span className="text-sm font-medium text-muted-foreground">Units donated</span>
          <div className="mt-3 text-2xl font-bold">{totalUnits}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Cost</th>
              <th className="px-3 py-2 text-left">Recipient / notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{formatManila(r.created_at, "MMM d, yyyy h:mm a")}</td>
                  <td className="px-3 py-2 font-medium">{r.product_name ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right">{formatCentavos(r.total_cost_centavos)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="h-16 text-center text-muted-foreground">
                  No donations recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
