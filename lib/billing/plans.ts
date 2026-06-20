/**
 * Subscription plans (Section 2.7). Prices in PHP centavos. These are the
 * product catalog the Xendit integration would create plans for; in dev they
 * are display-only because billing is feature-flagged off.
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
    description: "For a single branch getting started.",
    features: ["1 branch", "Up to 2 staff", "POS + inventory", "Expiry & low-stock alerts"],
  },
  {
    id: "starter",
    name: "Starter",
    priceCentavos: 49900,
    interval: "month",
    description: "For a growing independent pharmacy.",
    features: ["Up to 3 branches", "Unlimited staff", "Purchase orders", "Sales dashboard"],
  },
  {
    id: "pro",
    name: "Pro",
    priceCentavos: 149900,
    interval: "month",
    description: "For multi-branch operations.",
    features: [
      "Unlimited branches",
      "HRIS — QR time & attendance",
      "Advanced reports",
      "Priority support",
    ],
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

/** Whether a plan unlocks Pro-only features (e.g. HRIS). */
export function isProPlan(plan: string): boolean {
  return plan === "pro";
}
