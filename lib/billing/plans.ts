/**
 * Subscription plans. Prices in PHP centavos.
 *
 * Free    — Basic POS + online ordering (QR code) + order number after ordering.
 * Starter — Everything in Free + inventory management, expiry alerts, purchase
 *           orders, and AI receipt scanning (1× per 7 days).
 * Pro     — Everything in Starter + unlimited branches (₱500/mo per additional
 *           branch beyond the first), HRIS, advanced reports, priority support.
 */
export type PlanId = "free" | "starter" | "pro";

export type Plan = {
  id: PlanId;
  name: string;
  priceCentavos: number;
  interval: "month";
  description: string;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceCentavos: 0,
    interval: "month",
    description: "For a single-branch pharmacy getting started.",
    features: [
      "1 branch · up to 2 staff",
      "Full POS with loyalty & discounts",
      "Online ordering via QR code",
      "Order number issued to customers",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    priceCentavos: 49900,
    interval: "month",
    description: "For a growing independent pharmacy.",
    features: [
      "Everything in Free",
      "Inventory management",
      "Expiry & low-stock alerts",
      "Purchase orders",
      "AI receipt scanning (1× per week)",
      "Sales dashboard",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceCentavos: 149900,
    interval: "month",
    description: "For multi-branch operations.",
    features: [
      "Everything in Starter",
      "Unlimited AI receipt scans",
      "Multiple branches (₱500/mo per extra branch)",
      "HRIS — QR time & attendance",
      "Advanced reports",
      "Priority support",
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Pro-only gated features (HRIS, unlimited branches, unlimited AI scans). */
export function isProPlan(plan: string): boolean {
  return plan === "pro";
}

/** Starter-and-above: inventory, alerts, purchase orders, limited AI scan. */
export function isStarterPlan(plan: string): boolean {
  return plan === "starter" || plan === "pro";
}

/** Whether this plan can use inventory, expiry alerts, and purchase orders. */
export function canUseInventory(plan: string): boolean {
  return isStarterPlan(plan);
}

/** Whether this plan can use AI receipt scanning at all. */
export function canUseAiScan(plan: string): boolean {
  return isStarterPlan(plan);
}

/** Starter scans are rate-limited to 1× per 7 days; Pro has no limit. */
export function isAiScanUnlimited(plan: string): boolean {
  return isProPlan(plan);
}

/** Whether this plan supports more than one branch. */
export function canUseMultiBranch(plan: string): boolean {
  return isProPlan(plan);
}
