"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAppContext } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/types";

export type Result = { ok: true } | { error: string };

const brandingSchema = z.object({
  brandName: z.string().max(60).optional().or(z.literal("")),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  receiptHeader: z.string().max(400).optional().or(z.literal("")),
  receiptFooter: z.string().max(400).optional().or(z.literal("")),
  paper: z.enum(["58mm", "80mm", "A4"]),
  autoPrint: z.boolean(),
  printerType: z.enum(["bluetooth", "browser"]).default("browser"),
});
export type BrandingInput = z.infer<typeof brandingSchema>;

async function currentBranding(): Promise<{
  orgId: string;
  branding: Record<string, unknown>;
}> {
  const ctx = await requireAppContext();
  const root = (ctx.organization.settings ?? {}) as { branding?: Record<string, unknown> };
  return { orgId: ctx.organization.id, branding: { ...(root.branding ?? {}) } };
}

export async function updateBranding(input: BrandingInput): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the owner can change branding" };
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { branding } = await currentBranding();
  const next = {
    ...branding,
    brand_name: parsed.data.brandName?.trim() || null,
    brand_color: parsed.data.brandColor ?? branding.brand_color ?? null,
    receipt: {
      header: parsed.data.receiptHeader?.trim() || null,
      footer: parsed.data.receiptFooter?.trim() || null,
      paper: parsed.data.paper,
      auto_print: parsed.data.autoPrint,
        printer_type: parsed.data.printerType,
    },
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...(ctx.organization.settings as object), branding: next } as Json })
    .eq("id", ctx.organization.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadLogo(dataUrl: string): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the owner can change branding" };
  if (!dataUrl.startsWith("data:image/")) return { error: "Invalid image" };

  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const ext = mime.includes("png") ? "png" : mime.includes("svg") ? "svg" : "jpg";
  const bytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
  if (bytes.length === 0 || bytes.length > 2_000_000) return { error: "Image too large (max 2MB)" };

  const path = `${ctx.organization.id}/logo-${Date.now()}.${ext}`;
  const service = createServiceClient();
  const { error: upErr } = await service.storage
    .from("branding")
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) return { error: upErr.message };

  const { branding } = await currentBranding();
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...(ctx.organization.settings as object), branding: { ...branding, logo_path: path } } as Json })
    .eq("id", ctx.organization.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeLogo(): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the owner can change branding" };
  const { branding } = await currentBranding();
  delete branding.logo_path;

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...(ctx.organization.settings as object), branding } as Json })
    .eq("id", ctx.organization.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
