"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext, type AppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { pesosToCentavos } from "@/lib/money";
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
    is_active: input.isActive,
    drug_class: nullify(input.drugClass),
    storage_conditions: nullify(input.storageConditions),
    contraindications: nullify(input.contraindications),
    side_effects: nullify(input.sideEffects),
    controlled_level: input.controlledLevel || null,
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
