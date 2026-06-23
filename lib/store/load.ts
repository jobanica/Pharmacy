import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { readBrand, type Brand } from "@/lib/branding";

type Branch = { id: string; name: string; address: string | null; phone: string | null };
type Product = {
  id: string;
  name: string;
  generic_name: string | null;
  unit: string;
  default_price_centavos: number;
  requires_prescription: boolean;
};

export type StoreData = {
  slug: string;
  name: string;
  brand: Brand;
  branches: Branch[];
  products: Product[];
};

/**
 * Resolve a public storefront either by org slug (/store/[slug]) or by a tenant's
 * connected custom domain (the proxy rewrites those requests here). Returns null
 * when the store does not exist, is suspended, or has no active branch — callers
 * map that to notFound().
 */
export async function loadStore(
  by: { slug: string } | { domain: string },
): Promise<StoreData | null> {
  const supabase = createServiceClient();

  const base = supabase
    .from("organizations")
    .select("id, name, slug, status, settings");
  const { data: org } =
    "slug" in by
      ? await base.eq("slug", by.slug).maybeSingle()
      : await base.eq("custom_domain", by.domain).maybeSingle();

  if (!org || org.status !== "active") return null;

  const [{ data: branches }, { data: products }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name, address, phone")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("products")
      .select("id, name, generic_name, unit, default_price_centavos, requires_prescription")
      .eq("organization_id", org.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (!branches || branches.length === 0) return null;

  return {
    slug: org.slug,
    name: org.name,
    brand: readBrand(org.settings),
    branches,
    products: products ?? [],
  };
}
