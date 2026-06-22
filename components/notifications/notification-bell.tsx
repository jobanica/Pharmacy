"use client";

import * as React from "react";
import { Bell, Check, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { markNotificationRead, markAllRead, generateNotifications } from "@/lib/notifications/actions";
import { formatManila } from "@/lib/date";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
};

const TYPE_ICONS: Record<string, string> = {
  low_stock: "📦",
  expiry_warning: "⏰",
  transfer_received: "🚚",
  return_processed: "↩️",
  shift_variance: "💰",
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [generating, startGenerate] = React.useTransition();
  const [marking, startMark] = React.useTransition();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function onGenerate() {
    startGenerate(async () => {
      const res = await generateNotifications();
      if ("error" in res) { toast.error(res.error); return; }
      toast.success(res.count ? `${res.count} new alert${res.count > 1 ? "s" : ""} generated` : "No new alerts");
      router.refresh();
    });
  }

  function onMarkAll() {
    startMark(async () => {
      const res = await markAllRead();
      if ("error" in res) { toast.error(res.error); return; }
      router.refresh();
    });
  }

  function onRead(id: string) {
    startMark(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-white/10 bg-[#1a1030] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="font-semibold text-sm">Notifications</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onGenerate}
                disabled={generating}
                title="Refresh alerts"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 transition-colors"
              >
                {generating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              </button>
              {unreadCount > 0 ? (
                <button
                  onClick={onMarkAll}
                  disabled={marking}
                  className="text-xs text-fuchsia-300 hover:underline"
                >
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No notifications yet.
                <br />
                <button onClick={onGenerate} className="mt-1 text-fuchsia-300 hover:underline text-xs">
                  Check alerts now
                </button>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 border-b border-white/5 px-4 py-3 last:border-0 ${
                    n.read_at ? "opacity-60" : "bg-white/[0.03]"
                  }`}
                >
                  <span className="mt-0.5 text-base">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${!n.read_at ? "font-medium" : ""}`}>{n.title}</p>
                    {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatManila(n.created_at, "MMM d, h:mm a")}
                    </p>
                  </div>
                  {!n.read_at ? (
                    <button
                      onClick={() => onRead(n.id)}
                      disabled={marking}
                      className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      title="Mark as read"
                    >
                      <Check className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
