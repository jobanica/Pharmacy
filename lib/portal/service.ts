import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCustomerTerms } from "@/lib/agent-kit";
import { portalConfig } from "./config";
import type { ManualPayment } from "@/lib/supabase/types";

/**
 * What the billing page needs to know about this pharmacy's relationship with
 * the agent portal. Read through the signed-in user's own client, so RLS does
 * the org scoping.
 */
export type PortalAccount = {
  /** Null for every account that signed up without a referral code. */
  agentCode: string | null;
  contractStatus: "unsigned" | "signed";
  contractSignedAt: string | null;
  minimumTermEndsAt: string | null;
};

export async function getPortalAccount(): Promise<PortalAccount | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("agent_code, contract_status, contract_signed_at, contract_minimum_term_ends_at")
    .maybeSingle();
  if (!data) return null;
  return {
    agentCode: data.agent_code,
    contractStatus: data.contract_status,
    contractSignedAt: data.contract_signed_at,
    minimumTermEndsAt: data.contract_minimum_term_ends_at,
  };
}

/** This pharmacy's submitted receipts, newest first. */
export async function getManualPayments(): Promise<ManualPayment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscription_manual_payments")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/**
 * What this pharmacy owes, according to the portal.
 *
 * The fees come from the commission rule the customer signed up under, so the
 * portal is the only place that knows them — Reseta must not guess, and must
 * not store a copy that silently goes stale. Null on any failure: the form
 * then simply asks for the amount without pre-filling it, which is how it
 * behaved before.
 */
export type PortalFees = { activationCentavos: number | null; monthlyCentavos: number | null };

export async function getPortalFees(organizationId: string): Promise<PortalFees | null> {
  const config = portalConfig();
  if (!config) return null;
  const terms = await getCustomerTerms(config, organizationId);
  if (!terms?.known) return null;
  return {
    activationCentavos: terms.activation_fee,
    monthlyCentavos: terms.monthly_fee,
  };
}
