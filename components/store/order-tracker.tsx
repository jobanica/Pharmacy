"use client";

import * as React from "react";
import { Check, Loader2, XCircle } from "lucide-react";

import { getOrderStatus } from "@/lib/orders/actions";
import type { OrderStatus } from "@/lib/supabase/types";

type Fulfillment = "pickup" | "delivery";

const STEP_LABELS: Record<Exclude<OrderStatus, "cancelled">, string> = {
  pending: "Order received",
  accepted: "Accepted",
  preparing: "Preparing your order",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  completed: "Completed",
};

function stepsFor(fulfillment: Fulfillment): Exclude<OrderStatus, "cancelled">[] {
  const base: Exclude<OrderStatus, "cancelled">[] = ["pending", "accepted", "preparing", "ready"];
  if (fulfillment === "delivery") base.push("out_for_delivery");
  base.push("completed");
  return base;
}

/**
 * Live order-status tracker for customers. Polls getOrderStatus every few
 * seconds (anonymous, no realtime) and renders a vertical stepper so the
 * customer sees each stage staff move the order through.
 */
export function OrderTracker({
  orderId,
  fulfillment,
  initialStatus = "pending",
}: {
  orderId: string;
  fulfillment: Fulfillment;
  initialStatus?: OrderStatus;
}) {
  const [status, setStatus] = React.useState<OrderStatus>(initialStatus);

  React.useEffect(() => {
    if (!orderId) return;
    let active = true;

    async function poll() {
      const res = await getOrderStatus(orderId);
      if (active && "ok" in res) setStatus(res.status);
    }

    poll();
    const id = setInterval(() => {
      // Stop polling once the order reaches a terminal state.
      if (status === "completed" || status === "cancelled") return;
      poll();
    }, 7000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [orderId, status]);

  if (status === "cancelled") {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <XCircle className="size-5" />
        This order was cancelled. Please contact the pharmacy if this is unexpected.
      </div>
    );
  }

  const steps = stepsFor(fulfillment);
  const currentIdx = steps.indexOf(status as Exclude<OrderStatus, "cancelled">);

  return (
    <div className="mt-6 rounded-xl border p-5 text-left">
      <p className="mb-4 text-sm font-medium">Order status</p>
      <ol className="grid gap-0">
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs " +
                    (done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 text-muted-foreground")
                  }
                >
                  {done ? (
                    <Check className="size-4" />
                  ) : active ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                {i < steps.length - 1 ? (
                  <span className={"my-0.5 h-6 w-px " + (done ? "bg-emerald-500" : "bg-muted-foreground/20")} />
                ) : null}
              </div>
              <span
                className={
                  "pt-1 text-sm " +
                  (active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground")
                }
              >
                {STEP_LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        This page updates automatically. Keep it open to follow your order.
      </p>
    </div>
  );
}
