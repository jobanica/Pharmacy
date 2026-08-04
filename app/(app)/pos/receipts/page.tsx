import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { ReceiptsList, type ReceiptRow } from "@/components/pos/receipts-list";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  gcash: "GCash",
  card: "Card",
  maya: "Maya",
  other: "Other",
};

export default async function ReceiptsPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const branchName = ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  const { data: sales } = await supabase
    .from("sales")
    .select(
      "id, receipt_number, created_at, total_centavos, status, payment_method, is_split_tender, customers(name)",
    )
    .eq("branch_id", ctx.activeBranchId)
    .order("created_at", { ascending: false })
    .limit(500);

  const receipts: ReceiptRow[] = (sales ?? []).map((s) => {
    const customer = (s as { customers: { name: string } | null }).customers;
    return {
      id: s.id,
      receiptNumber: String(s.receipt_number),
      createdAt: s.created_at,
      totalCentavos: s.total_centavos,
      status: s.status,
      payment: s.is_split_tender
        ? "Split"
        : PAYMENT_LABEL[s.payment_method as string] ?? String(s.payment_method),
      customer: customer?.name ?? "",
    };
  });

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Receipts"
        description={`All sales receipts for ${branchName}. Search by receipt number, customer, or payment.`}
      />
      <Link
        href="/pos"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to POS
      </Link>
      <ReceiptsList receipts={receipts} canManage={can(ctx.role, "void_sale")} />
    </div>
  );
}
