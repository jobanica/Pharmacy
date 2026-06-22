import Link from "next/link";
import { Plus } from "lucide-react";

import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StartStocktakeButton } from "@/components/inventory/start-stocktake-button";

export default async function StocktakeListPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: stocktakes } = await supabase
    .from("stocktakes")
    .select("id, status, notes, created_at, approved_at")
    .eq("branch_id", ctx.activeBranchId)
    .order("created_at", { ascending: false })
    .limit(30);

  const hasDraft = (stocktakes ?? []).some((s) => s.status === "draft");

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stocktake</h1>
        {can(ctx.role, "manage_catalog") && !hasDraft ? (
          <StartStocktakeButton />
        ) : hasDraft ? (
          <p className="text-sm text-amber-600">A draft stocktake is in progress.</p>
        ) : null}
      </div>

      {!stocktakes?.length ? (
        <p className="text-sm text-muted-foreground">No stocktakes yet. Start one to count inventory.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Approved</th>
              </tr>
            </thead>
            <tbody>
              {stocktakes.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/inventory/stocktake/${s.id}`} className="hover:underline">
                      {formatManila(s.created_at)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.notes ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={s.status === "approved" ? "secondary" : "default"}>
                      {s.status === "approved" ? "Approved" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {s.approved_at ? formatManila(s.approved_at) : "—"}
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
