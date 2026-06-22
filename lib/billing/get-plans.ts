import "server-only";

/**
 * Effective subscription plans: the static defaults in plans.ts merged with any
 * admin edits stored in public.plan_overrides. Falls back to the defaults if the
 * table is empty or unavailable, so the app never breaks if billing isn't set up.
 */
import { createClient } from "@/lib/supabase/server";
import { PLANS, type Plan, type PlanId } from "@/lib/billing/plans";

export async function getPlans(): Promise<Plan[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("plan_overrides")
      .select("id, name, price_centavos, description, features");

    if (!data || data.length === 0) return PLANS;

    const byId = new Map(data.map((o) => [o.id, o]));
    return PLANS.map((p) => {
      const o = byId.get(p.id);
      if (!o) return p;
      return {
        ...p,
        name: o.name ?? p.name,
        priceCentavos: o.price_centavos ?? p.priceCentavos,
        description: o.description ?? p.description,
        features: Array.isArray(o.features)
          ? (o.features as string[])
          : p.features,
      };
    });
  } catch {
    return PLANS;
  }
}

export async function getPlan(id: PlanId): Promise<Plan | undefined> {
  return (await getPlans()).find((p) => p.id === id);
}
