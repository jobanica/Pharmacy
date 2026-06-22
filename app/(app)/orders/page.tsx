import { headers } from "next/headers";

import { PageHeader } from "@/components/shell/page-header";
import { OrdersList, type OrderRow } from "@/components/orders/orders-list";
import { CopyInviteLink } from "@/components/settings/copy-invite-link";
import { StoreQr } from "@/components/store/store-qr";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const [{ data: orders }, { data: org }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, fulfillment, payment, status, delivery_address, delivery_lat, delivery_lng, notes, total_centavos, created_at, branches(name), order_items(product_name, quantity, line_total_centavos)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("organizations").select("slug").eq("id", ctx.organization.id).maybeSingle(),
  ]);

  const rows = (orders ?? []).map((o) => ({
    ...o,
    branch_name: (o as { branches: { name: string } | null }).branches?.name ?? "—",
    items: (o as { order_items: { product_name: string; quantity: number; line_total_centavos: number }[] }).order_items ?? [],
  })) as OrderRow[];

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const storeUrl = host && org?.slug ? `${proto}://${host}/store/${org.slug}` : "";

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Online Orders"
        description="Orders placed from your public storefront. Accept and fulfill them here."
        action={
          storeUrl ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">Your store link:</span>
              <CopyInviteLink url={storeUrl} />
            </div>
          ) : null
        }
      />
      {storeUrl ? (
        <StoreQr storeUrl={storeUrl} storeName={ctx.organization.name} />
      ) : null}
      <OrdersList orders={rows} />
    </div>
  );
}
