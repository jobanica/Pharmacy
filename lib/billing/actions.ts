"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireAppContext } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/provider";
import { getSubscription } from "@/lib/billing/service";
import type { PlanId } from "@/lib/billing/plans";

export type BillingResult = { error: string } | null;

/** Start a subscription checkout. No-op (returns error) when billing is off. */
export async function startCheckout(plan: PlanId): Promise<BillingResult> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the owner can manage billing" };

  const provider = await getBillingProvider();
  if (!provider.enabled) {
    return { error: "Billing is disabled in this environment" };
  }

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const returnUrl = `${proto}://${host}/settings`;

  const res = await provider.createCheckout({
    organizationId: ctx.organization.id,
    plan,
    email: ctx.user.email,
    returnUrl,
  });
  if (!res.ok) return { error: res.error };
  redirect(res.redirectUrl);
}

export async function cancelSubscription(): Promise<BillingResult> {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") return { error: "Only the owner can manage billing" };

  const provider = await getBillingProvider();
  if (!provider.enabled) return { error: "Billing is disabled in this environment" };

  const sub = await getSubscription();
  if (!sub?.xendit_subscription_id) return { error: "No active subscription" };

  const res = await provider.cancelSubscription(sub.xendit_subscription_id);
  if (!res.ok) return { error: res.error ?? "Cancel failed" };
  return null;
}
