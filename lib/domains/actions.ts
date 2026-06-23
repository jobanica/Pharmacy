"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { canUseCustomDomain } from "@/lib/billing/plans";
import { publicEnv } from "@/lib/env";

export type Result = { ok: true } | { error: string };

// A hostname: labels of letters/digits/hyphens separated by dots, at least one
// dot. We deliberately keep this strict and lowercase.
const HOST_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

const schema = z.object({ domain: z.string().min(1, "Enter a domain") });

export async function setCustomDomain(input: { domain: string }): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the owner can manage the domain" };
  if (!canUseCustomDomain(ctx.organization.plan)) {
    return { error: "Custom domains require the Pro plan." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const domain = normalizeDomain(parsed.data.domain);
  if (!HOST_RE.test(domain)) return { error: "Enter a valid domain, e.g. shop.mypharmacy.ph" };
  if (domain.endsWith(".vercel.app")) {
    return { error: "vercel.app domains can't be used as a custom domain." };
  }
  const primary = publicEnv.NEXT_PUBLIC_PRIMARY_HOST?.split(":")[0].toLowerCase();
  if (primary && domain === primary) {
    return { error: "That domain is reserved." };
  }

  const supabase = await createClient();

  // Guard against another org already owning this domain (the DB also enforces
  // this via a unique index, but we surface a friendlier message first).
  const { data: existing } = await supabase
    .from("organizations")
    .select("id")
    .eq("custom_domain", domain)
    .maybeSingle();
  if (existing && existing.id !== ctx.organization.id) {
    return { error: "That domain is already connected to another store." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ custom_domain: domain })
    .eq("id", ctx.organization.id);
  if (error) {
    if (error.code === "23505") {
      return { error: "That domain is already connected to another store." };
    }
    return { error: error.message };
  }

  revalidatePath("/settings/domain");
  return { ok: true };
}

export async function removeCustomDomain(): Promise<Result> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the owner can manage the domain" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ custom_domain: null })
    .eq("id", ctx.organization.id);
  if (error) return { error: error.message };

  revalidatePath("/settings/domain");
  return { ok: true };
}
