"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus } from "@/lib/orders/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type NewOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  fulfillment: string;
  total_centavos: number;
  notes: string | null;
};

/** Short attention chime played when a new order lands. */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [880, 1320];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  } catch {
    // Audio is best-effort.
  }
}

function fmt(centavos: number) {
  return `₱${(centavos / 100).toFixed(2)}`;
}

/**
 * Subscribes to new online orders for the current org via Supabase Realtime.
 * Shows a persistent modal popup with an Accept button; multiple orders queue
 * and are shown one at a time.
 */
export function NewOrderWatcher({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [queue, setQueue] = React.useState<NewOrder[]>([]);
  const [accepting, setAccepting] = React.useState(false);

  const current = queue[0] ?? null;

  React.useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`orders-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const o = payload.new as NewOrder;
          playChime();
          setQueue((q) => [...q, o]);
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  function dismiss() {
    setQueue((q) => q.slice(1));
  }

  async function accept() {
    if (!current) return;
    setAccepting(true);
    const res = await updateOrderStatus(current.id, "accepted");
    setAccepting(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(`Order ${current.order_number} accepted`);
    dismiss();
    router.push("/orders");
    router.refresh();
  }

  if (!current) return null;

  return (
    <Dialog open>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            <DialogTitle>New Online Order</DialogTitle>
            {queue.length > 1 && (
              <Badge variant="outline" className="ml-auto">
                +{queue.length - 1} more
              </Badge>
            )}
          </div>
          <DialogDescription>
            A customer just placed an order from your storefront.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order</span>
            <span className="font-mono font-semibold">{current.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span>{current.customer_name}</span>
          </div>
          {current.customer_phone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span>{current.customer_phone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fulfillment</span>
            <span className="capitalize">{current.fulfillment}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">{fmt(current.total_centavos)}</span>
          </div>
          {current.notes && (
            <div className="flex justify-between gap-4">
              <span className="shrink-0 text-muted-foreground">Notes</span>
              <span className="text-right">{current.notes}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={dismiss} disabled={accepting}>
            Dismiss
          </Button>
          <Button size="sm" onClick={accept} disabled={accepting}>
            <CheckCircle2 className="size-4" />
            {accepting ? "Accepting…" : "Accept order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
