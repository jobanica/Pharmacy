import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { TransferForm } from "@/components/inventory/transfer-form";

export default async function NewTransferPage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_catalog")) redirect("/inventory/transfers");

  const supabase = await createClient();

  const [{ data: branches }, products, onHand] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name")
      .eq("organization_id", ctx.organization.id)
      .neq("id", ctx.activeBranchId)
      .order("name"),
    // Page through so all products load (PostgREST caps a response at 1000).
    fetchAllRows((from, to) =>
      supabase
        .from("products")
        .select("id, name, unit")
        .eq("organization_id", ctx.organization.id)
        .eq("is_active", true)
        .order("name")
        .order("id") // unique tiebreaker so paging never repeats/skips rows
        .range(from, to),
    ),
    fetchAllRows<{ product_id: string | null; on_hand: number | null }>((from, to) =>
      supabase
        .from("v_product_on_hand")
        .select("product_id, on_hand")
        .eq("branch_id", ctx.activeBranchId)
        .order("product_id")
        .range(from, to),
    ),
  ]);

  if (!branches?.length) {
    return (
      <div className="p-6 space-y-3">
        <Link href="/inventory/transfers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <p className="text-muted-foreground text-sm">
          No other branches found. Add another branch in Settings to enable transfers.
        </p>
      </div>
    );
  }

  const onHandMap = new Map(onHand.map((r) => [r.product_id, r.on_hand ?? 0]));
  const sellable = products
    .map((p) => ({ ...p, on_hand: onHandMap.get(p.id) ?? 0 }))
    .filter((p) => p.on_hand > 0);

  return (
    <div className="space-y-5 p-6 max-w-3xl">
      <Link
        href="/inventory/transfers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to transfers
      </Link>
      <h1 className="text-xl font-semibold">New Stock Transfer</h1>
      <p className="text-sm text-muted-foreground">
        Dispatching from <strong>{ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "this branch"}</strong>. Stock is deducted immediately.
      </p>
      <TransferForm branches={branches} products={sellable} />
    </div>
  );
}
