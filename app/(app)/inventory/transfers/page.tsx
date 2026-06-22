import Link from "next/link";
import { Plus } from "lucide-react";

import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<string, string> = {
  in_transit: "In Transit",
  received: "Received",
  cancelled: "Cancelled",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  in_transit: "default",
  received: "secondary",
  cancelled: "destructive",
};

export default async function TransfersPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const branchId = ctx.activeBranchId;

  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase
      .from("stock_transfers")
      .select("id, to_branch_id, status, created_at, notes")
      .eq("from_branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("stock_transfers")
      .select("id, from_branch_id, status, created_at, notes")
      .eq("to_branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const branchIds = [
    ...new Set([
      ...(outgoing ?? []).map((r) => r.to_branch_id),
      ...(incoming ?? []).map((r) => r.from_branch_id),
    ]),
  ];
  const { data: branches } = branchIds.length
    ? await supabase.from("branches").select("id, name").in("id", branchIds)
    : { data: [] };
  const branchMap = new Map((branches ?? []).map((b) => [b.id, b.name]));

  const pendingIncoming = (incoming ?? []).filter((r) => r.status === "in_transit").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Stock Transfers</h1>
          {pendingIncoming > 0 ? (
            <p className="text-sm text-amber-600 mt-0.5">
              {pendingIncoming} incoming transfer{pendingIncoming > 1 ? "s" : ""} awaiting receipt
            </p>
          ) : null}
        </div>
        {can(ctx.role, "manage_catalog") ? (
          <Button size="sm" render={<Link href="/inventory/transfers/new" />}>
            <Plus className="mr-1 size-4" /> New transfer
          </Button>
        ) : null}
      </div>

      <Section title="Incoming" rows={incoming ?? []} branchKey="from_branch_id" branchMap={branchMap} label="From" />
      <Section title="Outgoing" rows={outgoing ?? []} branchKey="to_branch_id" branchMap={branchMap} label="To" />
    </div>
  );
}

function Section({
  title,
  rows,
  branchKey,
  branchMap,
  label,
}: {
  title: string;
  rows: { id: string; status: string; created_at: string; notes: string | null; [k: string]: string | null }[];
  branchKey: string;
  branchMap: Map<string, string>;
  label: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">{label}</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/inventory/transfers/${r.id}`} className="hover:underline">
                      {formatManila(r.created_at)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{branchMap.get(r[branchKey] as string) ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.notes ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
