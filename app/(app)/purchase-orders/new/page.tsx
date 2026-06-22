import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { CreatePoForm } from "@/components/purchase-orders/create-po-form";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";

export default async function NewPurchaseOrderPage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) notFound();
  const supabase = await createClient();

  const [{ data: products }, { data: suppliers }, { data: lowStock }] = await Promise.all([
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("id, name").order("name"),
    supabase
      .from("v_low_stock")
      .select("product_id, product_name, unit, on_hand, reorder_point, deficit")
      .eq("branch_id", ctx.activeBranchId)
      .order("deficit", { ascending: false }),
  ]);

  return (
    <div>
      <Link
        href="/purchase-orders"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to purchase orders
      </Link>
      <PageHeader title="New purchase order" description="Draft an order to send to a supplier." />
      <CreatePoForm
        products={products ?? []}
        suppliers={suppliers ?? []}
        lowStock={(lowStock ?? [])
          .filter((r) => r.product_id)
          .map((r) => ({
            product_id: r.product_id as string,
            product_name: r.product_name ?? "—",
            unit: r.unit ?? "unit",
            on_hand: r.on_hand ?? 0,
            reorder_point: r.reorder_point ?? 0,
            deficit: r.deficit ?? 1,
          }))}
      />
    </div>
  );
}
