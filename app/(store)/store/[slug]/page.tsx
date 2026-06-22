import { notFound } from "next/navigation";

import { Storefront } from "@/components/store/storefront";
import { createServiceClient } from "@/lib/supabase/service";
import { readBrand } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, status, settings")
    .eq("slug", slug)
    .maybeSingle();
  if (!org || org.status !== "active") notFound();

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

  if (!branches || branches.length === 0) notFound();

  const brand = readBrand(org.settings);

  return (
    <Storefront
      orgSlug={slug}
      storeName={org.name}
      logoUrl={brand.logoUrl}
      branches={branches}
      products={products ?? []}
    />
  );
}
