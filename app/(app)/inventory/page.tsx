import { PageHeader } from "@/components/shell/page-header";
import { ProductsTable, type ProductWithCategory } from "@/components/inventory/products-table";
import { CategoryManager } from "@/components/inventory/category-manager";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";

export default async function InventoryPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "manage_catalog");

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, generic_name, category_id, sku, barcode, unit, requires_prescription, reorder_point, default_price_centavos, is_active, categories(name)",
      )
      .order("name", { ascending: true }),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const rows: ProductWithCategory[] = (products ?? []).map((p) => {
    const { categories: cat, ...rest } = p as typeof p & {
      categories: { name: string } | null;
    };
    return { ...rest, category_name: cat?.name ?? null };
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
        description="Your product catalog. Stock batches and movements arrive in Milestone 4."
        action={canManage ? <CategoryManager categories={categoryList} /> : null}
      />
      <ProductsTable
        products={rows}
        categories={categoryList}
        canManage={canManage}
      />
    </div>
  );
}
