"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ExternalLink, Undo2, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import { voidSale } from "@/lib/pos/actions";

export type ReceiptRow = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  totalCentavos: number;
  status: string;
  payment: string;
  customer: string;
};

export function ReceiptsList({
  receipts,
  canManage = false,
}: {
  receipts: ReceiptRow[];
  canManage?: boolean;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) =>
        r.receiptNumber.toLowerCase().includes(q) ||
        r.customer.toLowerCase().includes(q) ||
        r.payment.toLowerCase().includes(q),
    );
  }, [receipts, query]);

  return (
    <div className="grid gap-3">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by receipt #, customer, or payment…"
          className="pl-9"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">OR No.</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Payment</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 text-muted-foreground">{formatManila(r.createdAt)}</td>
                <td className="px-3 py-2 font-mono">{r.receiptNumber}</td>
                <td className="px-3 py-2">{r.customer || "—"}</td>
                <td className="px-3 py-2">{r.payment}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCentavos(r.totalCentavos)}</td>
                <td className="px-3 py-2">
                  {r.status === "voided" ? (
                    <Badge variant="outline" className="text-destructive">Voided</Badge>
                  ) : (
                    <Badge variant="secondary">Completed</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    {canManage && r.status !== "voided" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          render={<Link href={`/pos/receipt/${r.id}/return`} />}
                        >
                          <Undo2 className="size-3.5" /> Return
                        </Button>
                        <VoidButton saleId={r.id} receiptNumber={r.receiptNumber} />
                      </>
                    ) : null}
                    <Link
                      href={`/pos/receipt/${r.id}`}
                      className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Open <ExternalLink className="size-3" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-16 text-center text-muted-foreground">
                  {receipts.length === 0 ? "No receipts yet." : "No receipts match your search."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {receipts.length} recent receipt(s).
      </p>
    </div>
  );
}

function VoidButton({ saleId, receiptNumber }: { saleId: string; receiptNumber: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  function onVoid() {
    if (!window.confirm(`Void receipt ${receiptNumber}? Stock is restored and the sale is reversed.`)) {
      return;
    }
    start(async () => {
      const res = await voidSale(saleId);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success(`Receipt ${receiptNumber} voided`);
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-destructive"
      onClick={onVoid}
      disabled={pending}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Ban className="size-3.5" />} Void
    </Button>
  );
}
