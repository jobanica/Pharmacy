"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAppContext } from "@/lib/auth/session";
import { isProPlan } from "@/lib/billing/plans";
import type { AttendanceKind } from "@/lib/supabase/types";

export type Result = { ok: true } | { error: string };

const schema = z.object({
  branchId: z.string().uuid(),
  kind: z.enum(["clock_in", "clock_out"]),
  // data URL "data:image/jpeg;base64,...."; optional but recommended.
  photo: z.string().optional(),
});

export async function recordAttendance(input: {
  branchId: string;
  kind: AttendanceKind;
  photo?: string;
}): Promise<Result> {
  const ctx = await requireAppContext();
  if (!isProPlan(ctx.organization.plan)) {
    return { error: "Time & attendance is a Pro feature" };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { branchId, kind, photo } = parsed.data;

  const supabase = await createClient();

  // RLS ensures the branch is in the caller's org.
  const { data: branch } = await supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .maybeSingle();
  if (!branch) return { error: "Invalid branch" };

  // Upload the selfie to the private bucket via the service role.
  let photoPath: string | null = null;
  if (photo?.startsWith("data:image")) {
    const base64 = photo.split(",")[1] ?? "";
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > 0 && bytes.length < 3_000_000) {
      const path = `${ctx.organization.id}/${ctx.user.id}/${Date.now()}.jpg`;
      const service = createServiceClient();
      const { error: upErr } = await service.storage
        .from("attendance")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (!upErr) photoPath = path;
    }
  }

  const { error } = await supabase.from("attendance").insert({
    organization_id: ctx.organization.id,
    branch_id: branchId,
    user_id: ctx.user.id,
    kind,
    photo_path: photoPath,
  });
  if (error) return { error: error.message };

  revalidatePath("/hris");
  return { ok: true };
}
