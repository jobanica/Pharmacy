import { notFound } from "next/navigation";

import { LabelSheet } from "@/components/labels/label-sheet";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function LabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { productId } = await params;
  const { branchId: qsBranch } = await searchParams;

  const ctx = await requireAppContext();
  const branchId = qsBranch ?? ctx.activeBranchId;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, generic_name, unit, default_price_centavos, sku, barcode")
    .eq("id", productId)
    .maybeSingle();

  if (!product) notFound();

  const { data: batches } = await supabase
    .from("batches")
    .select("id, batch_number, expiry_date, quantity")
    .eq("product_id", productId)
    .eq("branch_id", branchId)
    .gt("quantity", 0)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  return (
    <LabelSheet
      product={product}
      batches={batches ?? []}
      orgName={ctx.organization.name}
    />
  );
}
