"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";

export type OrgResult = { ok: true } | { error: string };

const schema = z.object({
  name: z.string().trim().min(1, "Pharmacy name is required").max(120),
});

/** Owner edits the organization's business name. */
export async function updateOrganization(
  input: z.input<typeof schema>,
): Promise<OrgResult> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") {
    return { error: "Only the owner can edit organization details." };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: parsed.data.name })
    .eq("id", ctx.organization.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
