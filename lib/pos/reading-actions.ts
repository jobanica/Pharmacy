"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

const schema = z.object({
  type: z.enum(["x", "z"]),
  openingCash: z.coerce.number({ error: "Opening cash must be a number" }).int().min(0).default(0),
  openedAt: z.string().optional(),
});

export type ReadingResult = { ok: true; readingId: string } | { error: string };

export async function closeReading(input: z.input<typeof schema>): Promise<ReadingResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) return { error: "Insufficient role" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_reading", {
    p_branch: ctx.activeBranchId,
    p_type: d.type,
    p_opening_cash: d.openingCash,
    p_opened_at: d.openedAt ?? null,
  });

  if (error) return { error: error.message };
  return { ok: true, readingId: String(data) };
}
