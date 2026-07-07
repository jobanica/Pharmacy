"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext, type AppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { pesosToCentavos } from "@/lib/money";
import {
  createPoSchema,
  poHeaderSchema,
  poItemInputSchema,
  receivePoSchema,
  type CreatePoInput,
  type PoHeaderInput,
  type ReceivePoInput,
} from "@/lib/validation/po";
import { z } from "zod";

export type Result = { ok: true } | { error: string };
export type CreateResult = { ok: true; id: string } | { error: string };

async function guard(): Promise<{ error: string } | { ctx: AppContext }> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "use_purchase_orders")) {
    return { error: "You do not have permission to manage purchase orders" };
  }
  return { ctx };
}

export async function createPurchaseOrder(
  input: CreatePoInput,
): Promise<CreateResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = createPoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_purchase_order", {
    p_branch: g.ctx.activeBranchId,
    p_items: d.items.map((i) => ({
      product_id: i.productId,
      quantity_ordered: i.quantityOrdered,
      unit_cost_centavos: pesosToCentavos(i.unitCost),
    })),
    ...(d.supplierId ? { p_supplier: d.supplierId } : {}),
    ...(d.expectedDate ? { p_expected_date: d.expectedDate } : {}),
    ...(d.notes?.trim() ? { p_notes: d.notes.trim() } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath("/purchase-orders");
  return { ok: true, id: data as string };
}

/** Create a draft PO pre-filled with all current low-stock items (active branch). */
export async function createPoFromLowStock(): Promise<CreateResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const supabase = await createClient();

  const { data: low } = await supabase
    .from("v_low_stock")
    .select("product_id, deficit")
    .eq("branch_id", g.ctx.activeBranchId);

  if (!low || low.length === 0) {
    return { error: "No low-stock items to reorder" };
  }

  const { data, error } = await supabase.rpc("create_purchase_order", {
    p_branch: g.ctx.activeBranchId,
    p_items: low.map((r) => ({
      product_id: r.product_id as string,
      quantity_ordered: Math.max(r.deficit ?? 1, 1),
      unit_cost_centavos: 0,
    })),
  });
  if (error) return { error: error.message };

  revalidatePath("/purchase-orders");
  return { ok: true, id: data as string };
}

export async function updatePoHeader(
  poId: string,
  input: PoHeaderInput,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = poHeaderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_orders")
    .update({
      supplier_id: parsed.data.supplierId || null,
      expected_date: parsed.data.expectedDate || null,
      notes: parsed.data.notes?.trim() || null,
    })
    .eq("id", poId);
  if (error) return { error: error.message };
  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

export async function addPoItem(
  poId: string,
  input: z.input<typeof poItemInputSchema>,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = poItemInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_order_items").insert({
    organization_id: g.ctx.organization.id,
    purchase_order_id: poId,
    product_id: parsed.data.productId,
    quantity_ordered: parsed.data.quantityOrdered,
    unit_cost_centavos: pesosToCentavos(parsed.data.unitCost),
  });
  if (error) return { error: error.message };
  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

export async function removePoItem(itemId: string, poId: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_order_items")
    .delete()
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["sent", "cancelled"],
  sent: ["cancelled"],
};

export async function setPoStatus(
  poId: string,
  status: "sent" | "cancelled",
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", poId)
    .maybeSingle();
  if (!po) return { error: "Purchase order not found" };
  if (!STATUS_TRANSITIONS[po.status]?.includes(status)) {
    return { error: `Cannot move a ${po.status} PO to ${status}` };
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status })
    .eq("id", poId);
  if (error) return { error: error.message };
  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/purchase-orders");
  return { ok: true };
}

const receivePoItemSchema = z.object({
  quantityReceived: z.coerce.number().int().positive("Enter a quantity"),
  batchNumber: z.string().max(64).optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
});
export type ReceivePoItemInput = z.input<typeof receivePoItemSchema>;

/** Update a draft PO line's ordered quantity and unit cost. */
export async function updatePoItem(
  itemId: string,
  poId: string,
  quantityOrdered: string | number,
  costPesos: string | number,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };

  const qty = Math.trunc(Number(quantityOrdered));
  if (!Number.isFinite(qty) || qty < 1) return { error: "Quantity must be at least 1" };
  const cents = pesosToCentavos(costPesos);
  if (!Number.isFinite(cents) || cents < 0) return { error: "Invalid cost" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_order_items")
    .update({ quantity_ordered: qty, unit_cost_centavos: cents })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

/** Update a PO line's unit cost (e.g. when the receipt differs from the order). */
export async function updatePoItemCost(
  itemId: string,
  poId: string,
  costPesos: string | number,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const cents = pesosToCentavos(costPesos);
  if (!Number.isFinite(cents) || cents < 0) return { error: "Invalid cost" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("purchase_order_items")
    .update({ unit_cost_centavos: cents })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/purchase-orders/${poId}`);
  return { ok: true };
}

/** Receive a single PO line into inventory (used by the scan-and-add flow). */
export async function receivePoItem(
  itemId: string,
  poId: string,
  input: ReceivePoItemInput,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = receivePoItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_po_item", {
    p_item: itemId,
    p_quantity: parsed.data.quantityReceived,
    ...(parsed.data.batchNumber?.trim() ? { p_batch_number: parsed.data.batchNumber.trim() } : {}),
    ...(parsed.data.expiryDate ? { p_expiry: parsed.data.expiryDate } : {}),
  });
  if (error) return { error: error.message };

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/inventory");
  revalidatePath("/alerts");
  return { ok: true };
}

const extraItemSchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  newProductName: z.string().max(200).optional().or(z.literal("")),
  newGenericName: z.string().max(200).optional().or(z.literal("")),
  quantityReceived: z.coerce.number().int().positive("Enter a quantity"),
  unitCost: z.coerce.number().min(0).default(0),
  batchNumber: z.string().max(64).optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
}).refine(
  (l) => (l.productId && l.productId.length > 0) || (l.newProductName ?? "").trim().length > 0,
  { message: "An extra item needs a product or a name to create one" },
);
export type ExtraItemInput = z.input<typeof extraItemSchema>;

/**
 * Receive an item that was on the delivery but NOT on the PO: add it to the PO
 * as a line (creating the product if needed), then receive it into the PO's
 * branch with the PO's supplier attached.
 */
export async function addAndReceivePoItem(
  poId: string,
  input: ExtraItemInput,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = extraItemSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const orgId = g.ctx.organization.id;

  // Resolve the product: existing id wins; else find-or-create by name.
  let productId = d.productId && d.productId.length > 0 ? d.productId : null;
  if (!productId) {
    const name = (d.newProductName ?? "").trim();
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", name)
      .maybeSingle();
    if (existing) {
      productId = existing.id;
    } else {
      const { data: created, error: prodErr } = await supabase
        .from("products")
        .insert({
          organization_id: orgId,
          name,
          generic_name: (d.newGenericName ?? "").trim() || null,
        })
        .select("id")
        .single();
      if (prodErr) return { error: `Couldn't create "${name}": ${prodErr.message}` };
      productId = created.id;
    }
  }

  // Add the line to the PO (ordered = received, since it was delivered).
  const cost = pesosToCentavos(d.unitCost);
  const { data: item, error: itemErr } = await supabase
    .from("purchase_order_items")
    .insert({
      organization_id: orgId,
      purchase_order_id: poId,
      product_id: productId,
      quantity_ordered: d.quantityReceived,
      unit_cost_centavos: cost,
    })
    .select("id")
    .single();
  if (itemErr) return { error: itemErr.message };

  // Receive it into inventory (branch + supplier come from the PO).
  const { error: rpcErr } = await supabase.rpc("receive_po_item", {
    p_item: item.id,
    p_quantity: d.quantityReceived,
    ...(d.batchNumber?.trim() ? { p_batch_number: d.batchNumber.trim() } : {}),
    ...(d.expiryDate ? { p_expiry: d.expiryDate } : {}),
  });
  if (rpcErr) return { error: rpcErr.message };

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/inventory");
  revalidatePath("/alerts");
  return { ok: true };
}

export type ReverseResult = { ok: true; reversedUnits: number } | { error: string };

/** Reverse all stock received against a PO (undo a wrong scan). Resets to 'sent'. */
export async function reversePoReceiving(poId: string): Promise<ReverseResult> {
  const g = await guard();
  if ("error" in g) return { error: g.error };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reverse_po_receiving", { p_po: poId });
  if (error) return { error: error.message };

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/inventory");
  revalidatePath("/alerts");
  const reversedUnits = (data as { reversed_units?: number } | null)?.reversed_units ?? 0;
  return { ok: true, reversedUnits };
}

export async function receivePurchaseOrder(
  poId: string,
  input: ReceivePoInput,
): Promise<Result> {
  const g = await guard();
  if ("error" in g) return { error: g.error };
  const parsed = receivePoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const lines = parsed.data.lines.filter((l) => l.quantityReceived > 0);
  if (lines.length === 0) return { error: "Enter at least one received quantity" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", {
    p_po: poId,
    p_lines: lines.map((l) => ({
      item_id: l.itemId,
      quantity_received: l.quantityReceived,
      batch_number: l.batchNumber || null,
      expiry_date: l.expiryDate || null,
    })),
  });
  if (error) return { error: error.message };

  revalidatePath(`/purchase-orders/${poId}`);
  revalidatePath("/inventory");
  return { ok: true };
}
