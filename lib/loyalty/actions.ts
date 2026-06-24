"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/types";
import { customerSchema, loyaltySettingsSchema, type CustomerInput, type LoyaltySettingsInput } from "@/lib/validation/loyalty";

export type CustomerResult =
  | { ok: true; customer: { id: string; name: string; phone: string | null; points_balance: number } }
  | { error: string };
export type Result = { ok: true } | { error: string };

function fields(input: CustomerInput) {
  const nz = (v?: string) => (v && v.trim() ? v.trim() : null);
  return {
    name: input.name.trim(),
    phone: nz(input.phone),
    email: nz(input.email),
    address: nz(input.address),
    birthdate: input.birthdate ? input.birthdate : null,
    notes: nz(input.notes),
  };
}

/** Create a customer (used at the POS and the Customers database). */
export async function createCustomer(input: CustomerInput): Promise<CustomerResult> {
  const ctx = await requireAppContext();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({ organization_id: ctx.organization.id, ...fields(parsed.data) })
    .select("id, name, phone, points_balance")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "A customer with that phone already exists" };
    return { error: error.message };
  }
  revalidatePath("/customers");
  return { ok: true, customer: data };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Result> {
  await requireAppContext();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(fields(parsed.data)).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: "A customer with that phone already exists" };
    return { error: error.message };
  }
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

/** Owner/manager: set how many pesos of net spend earn one loyalty point. */
export async function updateLoyaltySettings(
  input: LoyaltySettingsInput,
): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { error: "Only an owner or manager can change loyalty settings" };
  }
  const parsed = loyaltySettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const current = (ctx.organization.settings ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...current,
        loyalty: { peso_per_point: parsed.data.pesoPerPoint },
      } as Json,
    })
    .eq("id", ctx.organization.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/pos");
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner" && ctx.role !== "manager") {
    return { error: "Only an owner or manager can delete customers" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { ok: true };
}
