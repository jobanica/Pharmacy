import Link from "next/link";

import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";

export type StaleRow = {
  product_id: string | null;
  product_name: string | null;
  unit: string | null;
  on_hand: number | null;
  value_centavos: number | null;
  last_sold_at: string | null;
  days_of_supply: number | null;
  sold_90d: number | null;
};

/** Dead-stock and slow-moving lists share this table (kind toggles columns). */
export function StaleStockTable({
  rows,
  kind,
  emptyMessage,
}: {
  rows: StaleRow[];
  kind: "dead" | "slow";
  emptyMessage: string;
}) {
  const totalValue = rows.reduce((s, r) => s + (r.value_centavos ?? 0), 0);

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {rows.length} item{rows.length !== 1 ? "s" : ""} · tied-up value{" "}
        <span className="font-semibold text-foreground">{formatCentavos(totalValue)}</span>
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">On hand</th>
              {kind === "slow" ? (
                <>
                  <th className="px-3 py-2 text-right">Sold (90d)</th>
                  <th className="px-3 py-2 text-right">Days of supply</th>
                </>
              ) : null}
              <th className="px-3 py-2 text-left">Last sold</th>
              <th className="px-3 py-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">
                  {r.product_id ? (
                    <Link href={`/inventory/${r.product_id}`} className="hover:underline">
                      {r.product_name ?? "—"}
                    </Link>
                  ) : (
                    r.product_name ?? "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.on_hand ?? 0} {r.unit ?? ""}
                </td>
                {kind === "slow" ? (
                  <>
                    <td className="px-3 py-2 text-right">{r.sold_90d ?? 0}</td>
                    <td className="px-3 py-2 text-right">
                      {r.days_of_supply != null ? `${r.days_of_supply}d` : "—"}
                    </td>
                  </>
                ) : null}
                <td className="px-3 py-2 text-muted-foreground">
                  {r.last_sold_at ? formatManila(r.last_sold_at, "MMM d, yyyy") : "Never sold"}
                </td>
                <td className="px-3 py-2 text-right">{formatCentavos(r.value_centavos ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
