import "server-only";

/**
 * Billing provider boundary (Xendit).
 *
 * This is the clean seam the rest of the app talks to. In dev, billing is
 * feature-flagged OFF (publicEnv.NEXT_PUBLIC_BILLING_ENABLED=false) and
 * {@link getBillingProvider} returns a no-op provider, so nothing ever calls
 * Xendit and no core feature is gated. When the flag is on AND XENDIT_SECRET_KEY
 * is set, the real Xendit provider is used.
 *
 * The Xendit calls are intentionally minimal and isolated here so swapping
 * providers (or wiring the full recurring-plans API) touches only this file.
 */
import { getPlan, type PlanId } from "./plans";
import { getPlatformBillingConfig } from "./platform-config";

export type CheckoutResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

export type WebhookEvent = {
  type: string;
  organizationId?: string;
  status?: string;
  subscriptionId?: string;
  currentPeriodEnd?: string | null;
};

export interface BillingProvider {
  readonly enabled: boolean;
  /** Begin a subscription checkout for an org + plan; returns a redirect URL. */
  createCheckout(input: {
    organizationId: string;
    plan: PlanId;
    email: string;
    returnUrl: string;
  }): Promise<CheckoutResult>;
  /** Cancel the org's active subscription. */
  cancelSubscription(subscriptionId: string): Promise<{ ok: boolean; error?: string }>;
}

/** No-op provider used when billing is disabled (dev default). */
const noopProvider: BillingProvider = {
  enabled: false,
  async createCheckout() {
    return { ok: false, error: "Billing is disabled in this environment" };
  },
  async cancelSubscription() {
    return { ok: false, error: "Billing is disabled in this environment" };
  },
};

const XENDIT_API = "https://api.xendit.co";

/** Real Xendit provider. Only constructed when the feature flag + key are set. */
function createXenditProvider(secretKey: string): BillingProvider {
  // Basic-auth header: secret key as username, empty password.
  const auth = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

  return {
    enabled: true,
    async createCheckout({ organizationId, plan, email, returnUrl }) {
      const planDef = getPlan(plan);
      if (!planDef || planDef.priceCentavos === 0) {
        return { ok: false, error: "Select a paid plan" };
      }
      try {
        // Xendit Invoice as the checkout surface (recurring plans can be wired
        // later via /recurring/plans). Amount is in PHP pesos.
        const res = await fetch(`${XENDIT_API}/v2/invoices`, {
          method: "POST",
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: JSON.stringify({
            external_id: `sub_${organizationId}_${plan}_${Date.now()}`,
            amount: planDef.priceCentavos / 100,
            currency: "PHP",
            payer_email: email,
            description: `Reseta ${planDef.name} subscription`,
            success_redirect_url: returnUrl,
            failure_redirect_url: returnUrl,
            metadata: { organization_id: organizationId, plan },
          }),
        });
        if (!res.ok) {
          return { ok: false, error: `Xendit error (${res.status})` };
        }
        const data = (await res.json()) as { invoice_url?: string };
        if (!data.invoice_url) return { ok: false, error: "No checkout URL returned" };
        return { ok: true, redirectUrl: data.invoice_url };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Checkout failed" };
      }
    },
    async cancelSubscription(subscriptionId) {
      try {
        const res = await fetch(
          `${XENDIT_API}/recurring/plans/${subscriptionId}/deactivate`,
          { method: "POST", headers: { Authorization: auth } },
        );
        return res.ok ? { ok: true } : { ok: false, error: `Xendit error (${res.status})` };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Cancel failed" };
      }
    },
  };
}

export async function getBillingProvider(): Promise<BillingProvider> {
  const cfg = await getPlatformBillingConfig();
  if (!cfg.enabled || !cfg.secretKey) return noopProvider;
  return createXenditProvider(cfg.secretKey);
}
