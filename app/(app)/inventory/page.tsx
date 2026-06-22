import { PageHeader } from "@/components/shell/page-header";
import { ProductsTable, type ProductWithCategory } from "@/components/inventory/products-table";
import { CategoryManager } from "@/components/inventory/category-manager";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { aiReceiptEnabled } from "@/lib/ai/receipt";
import { canUseInventory } from "@/lib/billing/plans";
import { PlanUpsell } from "@/components/billing/plan-upsell";

export default async function InventoryPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "manage_catalog");

  if (!canUseInventory(ctx.organization.plan)) {
    return (
      <div className="grid gap-4">
        <PlanUpsell
          title="Inventory Management"
          description="Track stock levels, batch numbers, and expiry dates across your products. Available on the Starter plan and above."
        />
      </div>
    );
  }
  const branchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ??
    "the active branch";

  const [{ data: products }, { data: categories }, { data: onHand }, { data: suppliers }, { data: batches }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, generic_name, category_id, sku, barcode, unit, requires_prescription, reorder_point, default_price_centavos, is_active, categories(name)",
        )
        .order("name", { ascending: true }),
      supabase.from("categories").select("id, name").order("name"),
      supabase
        .from("v_product_on_hand")
        .select("product_id, on_hand")
        .eq("branch_id", ctx.activeBranchId),
      supabase.from("suppliers").select("id, name").order("name"),
      // Batches in stock at this branch, soonest expiry first (nulls last) so the
      // first one we see per product is the next to expire (FEFO).
      supabase
        .from("batches")
        .select("product_id, batch_number, expiry_date")
        .eq("branch_id", ctx.activeBranchId)
        .gt("quantity", 0)
        .order("expiry_date", { ascending: true, nullsFirst: false }),
    ]);

  const onHandById = new Map(
    (onHand ?? []).map((r) => [r.product_id, r.on_hand ?? 0]),
  );

  // Nearest-expiry batch per product (first seen wins thanks to the ordering)
  // plus how many in-stock batches each product has.
  const nextBatchById = new Map<string, { batch_number: string | null; expiry_date: string | null }>();
  const batchCountById = new Map<string, number>();
  for (const b of batches ?? []) {
    if (!b.product_id) continue;
    batchCountById.set(b.product_id, (batchCountById.get(b.product_id) ?? 0) + 1);
    if (!nextBatchById.has(b.product_id)) {
      nextBatchById.set(b.product_id, {
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
      });
    }
  }

  const rows: ProductWithCategory[] = (products ?? []).map((p) => {
    const { categories: cat, ...rest } = p as typeof p & {
      categories: { name: string } | null;
    };
    const next = nextBatchById.get(rest.id);
    return {
      ...rest,
      category_name: cat?.name ?? null,
      on_hand: onHandById.get(rest.id) ?? 0,
      next_batch_number: next?.batch_number ?? null,
      next_expiry: next?.expiry_date ?? null,
      batch_count: batchCountById.get(rest.id) ?? 0,
    };
  });

  // Product counts per category for the manager dialog.
  const counts = new Map<string, number>();
  for (const p of rows) {
    if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  }
  const categoryList = (categories ?? []).map((c) => ({
    ...c,
    product_count: counts.get(c.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`On-hand shown for ${branchName}. Open a product to receive stock, adjust, and view its history.`}
        action={canManage ? <CategoryManager categories={categoryList} /> : null}
      />
      <ProductsTable
        products={rows}
        categories={categoryList}
        suppliers={suppliers ?? []}
        canManage={canManage}
        aiEnabled={aiReceiptEnabled()}
        branchName={branchName}
      />
    </div>
  );
}
