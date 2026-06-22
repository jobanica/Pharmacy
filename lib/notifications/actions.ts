"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAppContext } from "@/lib/auth/session";

export type Result = { ok: true; count?: number } | { error: string };

export async function generateNotifications(): Promise<Result> {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_alert_notifications", {
    p_branch: ctx.activeBranchId,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, count: data ?? 0 };
}

export async function markNotificationRead(id: string): Promise<Result> {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", ctx.organization.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllRead(): Promise<Result> {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("organization_id", ctx.organization.id)
    .is("read_at", null)
    .or(`user_id.is.null,user_id.eq.${ctx.user.id}`);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
