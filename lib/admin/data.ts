import "server-only";

/**
 * Read-side queries for the super-admin dashboard. All use the service role
 * (cross-tenant) and MUST only be called after requirePlatformAdmin().
 */
import { createServiceClient } from "@/lib/supabase/service";
import { getPlan } from "@/lib/billing/plans";

export type SubscriberRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
  members: number;
  branches: number;
  sales: number;
  revenueCentavos: number;
  monthlyPriceCentavos: number;
};

export type PlatformStats = {
  totalOrgs: number;
  activeOrgs: number;
  byPlan: { free: number; starter: number; pro: number };
  mrrCentavos: number;
};

export type AdminOverview = {
  subscribers: SubscriberRow[];
  stats: PlatformStats;
};

/** Everything the dashboard needs: subscriber rollups + platform totals. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const db = createServiceClient();

  const [{ data: orgs }, { data: memberships }, { data: branches }, { data: sales }] =
    await Promise.all([
      db
        .from("organizations")
        .select("id, name, slug, plan, status, created_at")
        .order("created_at", { ascending: false }),
      db.from("memberships").select("organization_id").eq("status", "active"),
      db.from("branches").select("organization_id").eq("is_active", true),
      db.from("sales").select("organization_id, total_centavos").eq("status", "completed"),
    ]);

  const memberCount = new Map<string, number>();
  for (const m of memberships ?? []) {
    memberCount.set(m.organization_id, (memberCount.get(m.organization_id) ?? 0) + 1);
  }
  const branchCount = new Map<string, number>();
  for (const b of branches ?? []) {
    branchCount.set(b.organization_id, (branchCount.get(b.organization_id) ?? 0) + 1);
  }
  const salesCount = new Map<string, number>();
  const revenue = new Map<string, number>();
  for (const s of sales ?? []) {
    salesCount.set(s.organization_id, (salesCount.get(s.organization_id) ?? 0) + 1);
    revenue.set(s.organization_id, (revenue.get(s.organization_id) ?? 0) + (s.total_centavos ?? 0));
  }

  const subscribers: SubscriberRow[] = (orgs ?? []).map((o) => {
    const price = getPlan(o.plan)?.priceCentavos ?? 0;
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      status: o.status,
      createdAt: o.created_at,
      members: memberCount.get(o.id) ?? 0,
      branches: branchCount.get(o.id) ?? 0,
      sales: salesCount.get(o.id) ?? 0,
      revenueCentavos: revenue.get(o.id) ?? 0,
      monthlyPriceCentavos: price,
    };
  });

  const byPlan = { free: 0, starter: 0, pro: 0 };
  let mrrCentavos = 0;
  let activeOrgs = 0;
  for (const s of subscribers) {
    if (s.plan in byPlan) byPlan[s.plan as keyof typeof byPlan] += 1;
    if (s.status === "active") {
      activeOrgs += 1;
      mrrCentavos += s.monthlyPriceCentavos;
    }
  }

  return {
    subscribers,
    stats: { totalOrgs: subscribers.length, activeOrgs, byPlan, mrrCentavos },
  };
}

export type FeedbackRow = {
  id: string;
  category: string;
  message: string;
  userEmail: string | null;
  orgName: string | null;
  createdAt: string;
};

/** Recent feedback submissions across all orgs. */
export async function getRecentFeedback(limit = 50): Promise<FeedbackRow[]> {
  const db = createServiceClient();
  const { data } = await db
    .from("feedback")
    .select("id, category, message, user_email, created_at, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((f) => ({
    id: f.id,
    category: f.category,
    message: f.message,
    userEmail: f.user_email,
    orgName: (f as { organizations: { name: string } | null }).organizations?.name ?? null,
    createdAt: f.created_at,
  }));
}
