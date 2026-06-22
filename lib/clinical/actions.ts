"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export type Result = { ok: true } | { error: string };

const interactionSchema = z.object({
  productIdA: z.string().uuid(),
  productIdB: z.string().uuid(),
  severity: z.enum(["minor", "moderate", "major"]).default("moderate"),
  description: z.string().max(2000).optional().nullable(),
});

export type InteractionInput = z.infer<typeof interactionSchema>;

async function guard(): Promise<{ error: string } | { ctx: ReturnType<typeof requireAppContext> extends Promise<infer T> ? T : never }> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) {
    return { error: "Permission denied" };
  }
  return { ctx };
}

export async function upsertInteraction(input: InteractionInput): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  const parsed = interactionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { productIdA: a, productIdB: b, severity, description } = parsed.data;
  if (a === b) return { error: "A product cannot interact with itself" };

  // Enforce canonical order (a < b) as required by the DB constraint.
  const [idA, idB] = a < b ? [a, b] : [b, a];

  const supabase = await createClient();
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

  const { error } = await supabase.from("drug_interactions").upsert(
    {
      organization_id: g.ctx.organization.id,
      product_id_a: idA,
      product_id_b: idB,
      severity,
      description: description?.trim() || null,
      created_by: userId,
    },
    { onConflict: "organization_id,product_id_a,product_id_b", ignoreDuplicates: false },
  );
  if (error) return { error: error.message };

  revalidatePath("/clinical/interactions");
  return { ok: true };
}

export async function deleteInteraction(id: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;

  const supabase = await createClient();
  const { error } = await supabase
    .from("drug_interactions")
    .delete()
    .eq("id", id)
    .eq("organization_id", g.ctx.organization.id);
  if (error) return { error: error.message };

  revalidatePath("/clinical/interactions");
  return { ok: true };
}
