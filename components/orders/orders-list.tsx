"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Phone, MapPin, Store, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateOrderStatus } from "@/lib/orders/actions";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import type { OrderStatus } from "@/lib/supabase/types";

export type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  fulfillment: "pickup" | "delivery";
  payment: "on_fulfillment" | "online";
  status: OrderStatus;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  notes: string | null;
  total_centavos: number;
  created_at: string;
  branch_name: string;
  items: { product_name: string; quantity: number; line_total_centavos: number }[];
};

const STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  accepted: { label: "Accepted", tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  preparing: { label: "Preparing", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  ready: { label: "Ready", tone: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  out_for_delivery: { label: "Out for delivery", tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" },
  completed: { label: "Completed", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Cancelled", tone: "bg-destructive/15 text-destructive" },
};

const FILTERS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

/** The forward actions available from each status (depends on fulfillment). */
function nextActions(o: OrderRow): { to: OrderStatus; label: string }[] {
  switch (o.status) {
    case "pending":
      return [{ to: "accepted", label: "Accept" }];
    case "accepted":
      return [{ to: "preparing", label: "Start preparing" }];
    case "preparing":
      return [{ to: "ready", label: o.fulfillment === "delivery" ? "Ready to dispatch" : "Ready for pickup" }];
    case "ready":
      return o.fulfillment === "delivery"
        ? [{ to: "out_for_delivery", label: "Out for delivery" }]
        : [{ to: "completed", label: "Mark picked up" }];
    case "out_for_delivery":
      return [{ to: "completed", label: "Mark delivered" }];
    default:
      return [];
  }
}

export function OrdersList({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"all" | OrderStatus>("all");
  const [busy, setBusy] = React.useState<string | null>(null);

  const counts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const o of orders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
    return m;
  }, [orders]);

  const shown = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  function move(o: OrderRow, to: OrderStatus) {
    setBusy(o.id);
    updateOrderStatus(o.id, to).then((res) => {
      setBusy(null);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(`${o.order_number} → ${STATUS_META[to].label}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
              (filter === f.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50")
            }
          >
            {f.label}
            {f.key !== "all" && counts.get(f.key) ? (
              <span className="ml-1 text-muted-foreground">{counts.get(f.key)}</span>
            ) : null}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          No orders here yet.
        </p>
      ) : (
        <div className="grid gap-3">
          {shown.map((o) => {
            const meta = STATUS_META[o.status];
            const actions = nextActions(o);
            const canCancel = o.status !== "completed" && o.status !== "cancelled";
            return (
              <div key={o.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{o.order_number}</span>
                      <Badge className={meta.tone}>{meta.label}</Badge>
                      <Badge variant="outline" className="gap-1">
                        {o.fulfillment === "delivery" ? <MapPin className="size-3" /> : <Store className="size-3" />}
                        {o.fulfillment}
                      </Badge>
                      <Badge variant="outline">
                        {o.payment === "online" ? "Pay online" : "Pay on fulfillment"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {o.customer_name} ·{" "}
                      <a href={`tel:${o.customer_phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <Phone className="size-3" />
                        {o.customer_phone}
                      </a>{" "}
                      · {o.branch_name} · {formatManila(o.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold">{formatCentavos(o.total_centavos)}</div>
                  </div>
                </div>

                <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                  <div className="grid gap-0.5">
                    {o.items.map((it, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="truncate">{it.quantity}× {it.product_name}</span>
                        <span className="shrink-0 text-muted-foreground">{formatCentavos(it.line_total_centavos)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">
                    {o.fulfillment === "delivery" ? (
                      <div className="text-muted-foreground">
                        <div className="font-medium text-foreground">Deliver to:</div>
                        <div>{o.delivery_address ?? "—"}</div>
                        {o.delivery_lat != null && o.delivery_lng != null ? (
                          <a
                            href={`https://www.openstreetmap.org/?mlat=${o.delivery_lat}&mlon=${o.delivery_lng}#map=17/${o.delivery_lat}/${o.delivery_lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <MapPin className="size-3" /> View on map <ExternalLink className="size-3" />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    {o.notes ? (
                      <div className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">Notes:</span> {o.notes}
                      </div>
                    ) : null}
                  </div>
                </div>

                {(actions.length > 0 || canCancel) ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                    {actions.map((a) => (
                      <Button key={a.to} size="sm" disabled={busy === o.id} onClick={() => move(o, a.to)}>
                        {busy === o.id ? <Loader2 className="size-4 animate-spin" /> : null}
                        {a.label}
                      </Button>
                    ))}
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy === o.id}
                        onClick={() => {
                          if (window.confirm(`Cancel order ${o.order_number}?`)) move(o, "cancelled");
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
