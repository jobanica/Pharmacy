"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext, type AppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { pesosToCentavos } from "@/lib/money";
import type { Json } from "@/lib/supabase/types";
import {
  productSchema,
  categorySchema,
  supplierSchema,
  type ProductInput,
  type CategoryInput,
  type SupplierInput,
} from "@/lib/validation/catalog";

export type Result = { ok: true; id?: string } | { error: string };

/** Empty string -> null for nullable text columns. */
function nullify(v: string | undefined | null): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

async function guard(): Promise<{ error: string } | { ctx: AppContext }> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) {
    return { error: "You do not have permission to manage the catalog" };
  }
  return { ctx };
}

function uniqueMessage(code?: string, detail?: string): string | null {
  if (code !== "23505") return null;
  if (detail?.includes("barcode")) return "That barcode is already used by another product";
  if (detail?.includes("sku")) return "That SKU is already used by another product";
  if (detail?.includes("categories")) return "A category with that name already exists";
  return "That value must be unique";
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
function productRow(input: ProductInput, organizationId: string) {
  return {
    organization_id: organizationId,
    name: input.name.trim(),
    generic_name: nullify(input.genericName),
    category_id: input.categoryId || null,
    sku: nullify(input.sku),
    barcode: nullify(input.barcode),
    unit: input.unit.trim() || "piece",
    requires_prescription: input.requiresPrescription,
    reorder_point: input.reorderPoint,
    default_price_centavos: pesosToCentavos(input.price),
    default_cost_centavos: pesosToCentavos(input.cost),
    is_active: input.isActive,
  };
}

export async function createProduct(input: ProductInput): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(productRow(parsed.data, g.ctx.organization.id))
    .select("id")
    .single();
  if (error) return { error: uniqueMessage(error.code, error.details) ?? error.message };

  revalidatePath("/inventory");
  return { ok: true, id: data.id };
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { organization_id: _omit, ...row } = productRow(
    parsed.data,
    g.ctx.organization.id,
  );
  void _omit;
  const { error } = await supabase.from("products").update(row).eq("id", id);
  if (error) return { error: uniqueMessage(error.code, error.details) ?? error.message };

  revalidatePath("/inventory");
  return { ok: true, id };
}

export async function setProductActive(
  id: string,
  isActive: boolean,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

export type MergeResult = { ok: true; merged: number } | { error: string };

/** Merge duplicate products (same name) into one record. Owner/manager only. */
export async function mergeDuplicateProducts(): Promise<MergeResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("merge_duplicate_products");
  if (error) return { error: error.message };

  revalidatePath("/inventory");
  const merged = (data as { merged?: number } | null)?.merged ?? 0;
  return { ok: true, merged };
}

export type ImportRow = {
  name?: string;
  genericName?: string;
  category?: string;
  sku?: string;
  barcode?: string;
  unit?: string;
  cost?: string | number;
  price?: string | number;
  quantity?: string | number;
  expiry?: string;
  reorderPoint?: string | number;
  requiresPrescription?: string | boolean;
};

export type ImportResult =
  | { ok: true; created: number; matched: number; skipped: number; batches: number; errors: string[] }
  | { error: string };

function toBool(v: string | boolean | undefined): boolean {
  if (typeof v === "boolean") return v;
  const t = (v ?? "").toString().trim().toLowerCase();
  return t === "yes" || t === "true" || t === "1" || t === "y";
}

function toInt(v: string | number | undefined): number {
  const n = typeof v === "number" ? v : parseInt((v ?? "").toString().trim(), 10);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/** Pesos (string/number) -> integer centavos. Blank/invalid -> 0. */
function toCentavos(v: string | number | undefined): number {
  const n = typeof v === "number" ? v : parseFloat((v ?? "").toString().replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Normalize an expiry cell to YYYY-MM-DD, or null when blank/unparseable.
 * Handles ISO dates and short pharmacy formats like "27-Apr" / "Apr-27"
 * (year 2027, April), defaulting to the first day of the month.
 */
function normalizeExpiry(raw: string | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;

  // Already ISO (YYYY-MM-DD or YYYY/MM/DD)
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "27-Apr" / "Apr-27" / "27 Apr" — a two-digit year + month name.
  const parts = s.split(/[-/\s]+/).filter(Boolean);
  if (parts.length === 2) {
    let year: number | null = null;
    let month: number | null = null;
    for (const p of parts) {
      const mon = MONTHS[p.slice(0, 3).toLowerCase()];
      if (mon) month = mon;
      else if (/^\d{1,4}$/.test(p)) {
        const num = parseInt(p, 10);
        year = num < 100 ? 2000 + num : num;
      }
    }
    if (year && month) {
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }
  return null;
}

/**
 * Bulk-create products (and opening-stock batches) from parsed CSV rows in a
 * single database round-trip. Categories are matched by name (case-insensitive)
 * and created on the fly. Rows with a positive on-hand quantity also get an
 * opening batch with the given cost and expiry. Invalid rows are skipped and
 * reported; valid rows still import.
 */
export async function importProductsCsv(rows: ImportRow[]): Promise<ImportResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows found in the file" };
  }
  if (rows.length > 5000) {
    return { error: "Too many rows — import up to 5000 at a time" };
  }

  // Build a plain JSON payload the Postgres import function understands.
  const payload = rows.map((r) => ({
    name: (r.name ?? "").toString().trim(),
    generic_name: (r.genericName ?? "").toString().trim(),
    category: (r.category ?? "").toString().trim(),
    sku: (r.sku ?? "").toString().trim(),
    barcode: (r.barcode ?? "").toString().trim(),
    unit: (r.unit ?? "").toString().trim() || "piece",
    price_centavos: toCentavos(r.price),
    cost_centavos: toCentavos(r.cost),
    quantity: toInt(r.quantity),
    expiry: normalizeExpiry(r.expiry?.toString()),
    reorder_point: toInt(r.reorderPoint),
    requires_prescription: toBool(r.requiresPrescription),
  }));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_products", {
    p_branch: g.ctx.activeBranchId,
    p_rows: payload as unknown as Json,
  });
  if (error) return { error: error.message };

  const result = (data ?? {}) as {
    created?: number;
    matched?: number;
    skipped?: number;
    batches?: number;
    errors?: string[];
  };

  revalidatePath("/inventory");
  return {
    ok: true,
    created: result.created ?? 0,
    matched: result.matched ?? 0,
    skipped: result.skipped ?? 0,
    batches: result.batches ?? 0,
    errors: result.errors ?? [],
  };
}


/**
 * Permanently delete a product. Blocked when it has transaction history
 * (sales, purchase orders, returns, transfers) so records aren't destroyed —
 * deactivate it instead in that case. Batches, movements and stocktake rows are
 * removed with it.
 */
export async function deleteProduct(id: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };

  const supabase = await createClient();

  // Refuse if the product appears in any historical record.
  const [sale, po, ret, xfer] = await Promise.all([
    supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("purchase_order_items").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("sale_return_items").select("id", { count: "exact", head: true }).eq("product_id", id),
    supabase.from("stock_transfer_items").select("id", { count: "exact", head: true }).eq("product_id", id),
  ]);
  if ((sale.count ?? 0) > 0 || (po.count ?? 0) > 0 || (ret.count ?? 0) > 0 || (xfer.count ?? 0) > 0) {
    return {
      error:
        "This product has sales or order history and can't be deleted. Turn it inactive instead to hide it.",
    };
  }

  // stocktake_items is ON DELETE RESTRICT; clear those snapshot rows first.
  await supabase.from("stocktake_items").delete().eq("product_id", id);

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { error: "This product is still referenced elsewhere. Turn it inactive instead." };
    }
    return { error: error.message };
  }

  revalidatePath("/inventory");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function createCategory(input: CategoryInput): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ organization_id: g.ctx.organization.id, name: parsed.data.name.trim() })
    .select("id")
    .single();
  if (error) return { error: uniqueMessage(error.code, error.details) ?? error.message };
  revalidatePath("/inventory");
  return { ok: true, id: data.id };
}

export async function deleteCategory(id: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const supabase = await createClient();
  // Products keep existing; their category_id is set null by the FK.
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
function supplierRow(input: SupplierInput, organizationId: string) {
  return {
    organization_id: organizationId,
    name: input.name.trim(),
    contact_person: nullify(input.contactPerson),
    phone: nullify(input.phone),
    email: nullify(input.email),
    address: nullify(input.address),
    notes: nullify(input.notes),
  };
}

export async function createSupplier(input: SupplierInput): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert(supplierRow(parsed.data, g.ctx.organization.id))
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  return { ok: true, id: data.id };
}

export async function updateSupplier(
  id: string,
  input: SupplierInput,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { organization_id: _omit, ...row } = supplierRow(
    parsed.data,
    g.ctx.organization.id,
  );
  void _omit;
  const { error } = await supabase.from("suppliers").update(row).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  return { ok: true, id };
}

export async function deleteSupplier(id: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/suppliers");
  return { ok: true };
}
