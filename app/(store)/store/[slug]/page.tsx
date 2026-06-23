import { notFound } from "next/navigation";

import { Storefront } from "@/components/store/storefront";
import { loadStore } from "@/lib/store/load";

export const dynamic = "force-dynamic";

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await loadStore({ slug });
  if (!store) notFound();

  return (
    <Storefront
      orgSlug={store.slug}
      storeName={store.name}
      logoUrl={store.brand.logoUrl}
      branches={store.branches}
      products={store.products}
    />
  );
}
