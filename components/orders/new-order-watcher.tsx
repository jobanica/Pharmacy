"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

type NewOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  fulfillment: string;
  total_centavos: number;
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
    // Audio is best-effort; ignore unsupported environments.
  }
}

/**
 * Subscribes to new online orders for the current org via Supabase Realtime and
 * raises a toast + chime so cashiers notice immediately, anywhere in the app.
 * Realtime applies the orders RLS policy, so only this org's orders arrive.
 */
export function NewOrderWatcher({ orgId }: { orgId: string }) {
  const router = useRouter();

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
          toast(
            `New order ${o.order_number}`,
            {
              description: `${o.customer_name} · ${o.fulfillment} · ₱${(o.total_centavos / 100).toFixed(2)}`,
              icon: <ShoppingBag className="size-4" />,
              duration: 12000,
              action: {
                label: "View",
                onClick: () => router.push("/orders"),
              },
            },
          );
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  return null;
}
