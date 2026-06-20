"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";

export type CustomerResult =
  | { ok: true; customer: { id: string; name: string; phone: string | null; points_balance: number } }
  | { error: string };

const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
});

/** Create a loyalty customer (used at the POS and the Customers page). */
export async function createCustomer(input: {
  name: string;
  phone?: string;
  email?: string;
}): Promise<CustomerResult> {
  const ctx = await requireAppContext();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .insert({
      organization_id: ctx.organization.id,
      name: parsed.data.name.trim(),
      phone: parsed.data.phone?.trim() || null,
      email: parsed.data.email?.trim() || null,
    })
    .select("id, name, phone, points_balance")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "A customer with that phone already exists" };
    return { error: error.message };
  }

  revalidatePath("/customers");
  return { ok: true, customer: data };
}
