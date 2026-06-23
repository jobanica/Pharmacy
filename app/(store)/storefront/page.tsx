import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { Storefront } from "@/components/store/storefront";
import { loadStore } from "@/lib/store/load";

export const dynamic = "force-dynamic";

/**
 * Custom-domain storefront. The proxy rewrites requests arriving on a tenant's
 * connected domain here; we resolve the org from the original Host header.
 */
export default async function CustomDomainStorePage() {
  const hdrs = await headers();
  const host = (hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  if (!host) notFound();

  const store = await loadStore({ domain: host });
  if (!store) notFound();

  return (
    <Storefront
      orgSlug={store.slug}
      storeName={store.brand.name}
      logoUrl={store.brand.logoUrl}
      brandColor={store.brand.brandColor}
      branches={store.branches}
      products={store.products}
    />
  );
}
