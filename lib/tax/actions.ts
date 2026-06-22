"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tin: z.string().max(20).optional(),
  businessAddress: z.string().max(300).optional(),
  accreditationNo: z.string().max(100).optional(),
  permitNo: z.string().max(100).optional(),
  atpNo: z.string().max(100).optional(),
  vatRatePct: z.coerce.number({ error: "VAT rate must be a number" }).min(0).max(100).default(12),
  orPrefix: z.string().max(20).default("OR"),
  orPadding: z.coerce.number({ error: "Padding must be a number" }).int().min(4).max(10).default(7),
});

export type TaxResult = { ok: true } | { error: string };

export async function saveTaxSettings(
  input: z.input<typeof schema>,
): Promise<TaxResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) return { error: "Insufficient role" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const patch = {
    tin: d.tin ?? "",
    business_address: d.businessAddress ?? "",
    accreditation_no: d.accreditationNo ?? "",
    permit_no: d.permitNo ?? "",
    atp_no: d.atpNo ?? "",
    vat_rate_pct: d.vatRatePct,
    or_prefix: d.orPrefix,
    or_padding: d.orPadding,
  };

  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...ctx.organization.settings as object, tax: patch } })
    .eq("id", ctx.organization.id);

  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
