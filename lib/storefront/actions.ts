"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAppContext } from "@/lib/auth/session";
import { pesosToCentavos } from "@/lib/money";
import type { Json } from "@/lib/supabase/types";

export type Result = { ok: true } | { error: string };

const methodSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().max(120).optional().or(z.literal("")),
  number: z.string().max(60).optional().or(z.literal("")),
});

const storefrontSchema = z.object({
  deliveryFee: z.coerce.number().min(0).default(0),
  gcash: methodSchema,
  maya: methodSchema,
  bank: methodSchema.extend({ bankName: z.string().max(120).optional().or(z.literal("")) }),
});
export type StorefrontInput = z.input<typeof storefrontSchema>;

type CurrentSettings =
  | { ok: false; error: string }
  | {
      ok: true;
      orgId: string;
      settings: Record<string, unknown>;
      storefront: Record<string, unknown>;
    };

async function currentSettings(): Promise<CurrentSettings> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") {
    return { ok: false, error: "Only the owner can change storefront settings" };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organization.id)
    .maybeSingle();
  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const storefront = (settings.storefront ?? {}) as Record<string, unknown>;
  return { ok: true, orgId: ctx.organization.id, settings, storefront };
}

export async function updateStorefront(input: StorefrontInput): Promise<Result> {
  const cur = await currentSettings();
  if (!cur.ok) return { error: cur.error };
  const parsed = storefrontSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const next = {
    ...cur.storefront, // preserve qr_path
    delivery_fee_centavos: pesosToCentavos(d.deliveryFee),
    gcash: { enabled: d.gcash.enabled, name: d.gcash.name ?? "", number: d.gcash.number ?? "" },
    maya: { enabled: d.maya.enabled, name: d.maya.name ?? "", number: d.maya.number ?? "" },
    bank: {
      enabled: d.bank.enabled,
      bank_name: d.bank.bankName ?? "",
      name: d.bank.name ?? "",
      number: d.bank.number ?? "",
    },
  };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...cur.settings, storefront: next } as Json })
    .eq("id", cur.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings/storefront");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function uploadStorefrontQr(dataUrl: string): Promise<Result> {
  const cur = await currentSettings();
  if (!cur.ok) return { error: cur.error };
  if (!dataUrl.startsWith("data:image/")) return { error: "Invalid image" };

  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  const ext = mime.includes("png") ? "png" : mime.includes("svg") ? "svg" : "jpg";
  const bytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
  if (bytes.length === 0 || bytes.length > 2_000_000) return { error: "Image too large (max 2MB)" };

  const path = `${cur.orgId}/storefront-qr-${Date.now()}.${ext}`;
  const service = createServiceClient();
  const { error: upErr } = await service.storage
    .from("branding")
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (upErr) return { error: upErr.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...cur.settings, storefront: { ...cur.storefront, qr_path: path } } as Json })
    .eq("id", cur.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings/storefront");
  return { ok: true };
}

export async function removeStorefrontQr(): Promise<Result> {
  const cur = await currentSettings();
  if (!cur.ok) return { error: cur.error };
  const storefront = { ...cur.storefront };
  delete storefront.qr_path;

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...cur.settings, storefront } as Json })
    .eq("id", cur.orgId);
  if (error) return { error: error.message };

  revalidatePath("/settings/storefront");
  return { ok: true };
}
