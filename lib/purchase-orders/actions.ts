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
  if (!can(ctx.role, "manage_catalog")) {
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
