"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAppContext } from "@/lib/auth/session";
import type { OrderStatus } from "@/lib/supabase/types";

export type Result = { ok: true } | { error: string };
export type PlaceOrderResult =
  | { ok: true; orderNumber: string; orderId: string }
  | { error: string };

const placeOrderSchema = z.object({
  orgSlug: z.string().min(1),
  branchId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(120),
  phone: z.string().min(1, "Phone is required").max(40),
  fulfillment: z.enum(["pickup", "delivery"]),
  payment: z.enum(["on_fulfillment", "online"]),
  address: z.string().max(400).optional().or(z.literal("")),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  notes: z.string().max(600).optional().or(z.literal("")),
  items: z
    .array(z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().positive() }))
    .min(1, "Your cart is empty"),
});
export type PlaceOrderInput = z.input<typeof placeOrderSchema>;

/**
 * Public storefront order placement. Runs server-side with the service client;
 * the org is resolved from its slug and prices are computed in place_order so
 * the (unauthenticated) client cannot tamper with totals.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("slug", d.orgSlug)
    .maybeSingle();
  if (!org || org.status !== "active") return { error: "This store is not available." };

  const { data, error } = await supabase.rpc("place_order", {
    p_org: org.id,
    p_branch: d.branchId,
    p_name: d.name,
    p_phone: d.phone,
    p_fulfillment: d.fulfillment,
    p_payment: d.payment,
    p_items: d.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    ...(d.address?.trim() ? { p_address: d.address.trim() } : {}),
    ...(typeof d.lat === "number" ? { p_lat: d.lat } : {}),
    ...(typeof d.lng === "number" ? { p_lng: d.lng } : {}),
    ...(d.notes?.trim() ? { p_notes: d.notes.trim() } : {}),
  });
  if (error) return { error: error.message };

  const orderNumber = data as string;
  // Resolve the new order's id so the customer can be handed a tracking view.
  const { data: row } = await supabase
    .from("orders")
    .select("id")
    .eq("organization_id", org.id)
    .eq("order_number", orderNumber)
    .maybeSingle();

  return { ok: true, orderNumber, orderId: row?.id ?? "" };
}

export type OrderStatusResult =
  | { ok: true; orderNumber: string; status: OrderStatus }
  | { error: string };

/**
 * Public order-status lookup for the storefront tracker. Anonymous customers
 * poll this after placing an order; it returns only the status fields, scoped
 * to a single order id, via the service client (orders have no public RLS).
 */
export async function getOrderStatus(orderId: string): Promise<OrderStatusResult> {
  if (!orderId) return { error: "Missing order" };
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("order_number, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Order not found" };
  return { ok: true, orderNumber: data.order_number, status: data.status as OrderStatus };
}

const ALLOWED: OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "cancelled",
];

/** Staff: move an order to a new status. RLS scopes it to the caller's org. */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Result> {
  const ctx = await requireAppContext();
  // Any active member can manage the order queue.
  if (!ctx) return { error: "Not authorized" };
  if (!ALLOWED.includes(status)) return { error: "Invalid status" };

  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) return { error: error.message };

  revalidatePath("/orders");
  return { ok: true };
}
