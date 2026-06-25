"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

function useCountdown(trialEndsAt: string) {
  const [msLeft, setMsLeft] = useState(() => new Date(trialEndsAt).getTime() - Date.now());

  useEffect(() => {
    const tick = () => setMsLeft(new Date(trialEndsAt).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [trialEndsAt]);

  if (msLeft <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

  const totalSecs = Math.floor(msLeft / 1000);
  return {
    days: Math.floor(totalSecs / 86400),
    hours: Math.floor((totalSecs % 86400) / 3600),
    minutes: Math.floor((totalSecs % 3600) / 60),
    seconds: totalSecs % 60,
    expired: false,
  };
}

function Seg({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="tabular-nums text-lg font-bold leading-none">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-white/60">{label}</span>
    </div>
  );
}

export function TrialBanner({ trialEndsAt }: { trialEndsAt: string }) {
  const { days, hours, minutes, seconds, expired } = useCountdown(trialEndsAt);

  if (expired) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-white shadow-lg">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0" />
        <span className="text-sm font-medium">
          Pro trial active — upgrade before it ends to keep all features.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Seg value={days} label="days" />
          <span className="mb-3 text-white/40">:</span>
          <Seg value={hours} label="hrs" />
          <span className="mb-3 text-white/40">:</span>
          <Seg value={minutes} label="min" />
          <span className="mb-3 text-white/40">:</span>
          <Seg value={seconds} label="sec" />
        </div>
        <Link
          href="/settings/billing"
          className="rounded-lg bg-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          Upgrade →
        </Link>
      </div>
    </div>
  );
}
