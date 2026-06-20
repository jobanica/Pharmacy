import Link from "next/link";
import { Sparkles } from "lucide-react";

/** "Go Pro" promo card at the bottom of the sidebar (links to billing). */
export function UpgradeCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-4 text-white shadow-lg shadow-fuchsia-600/20">
      <div className="absolute -right-6 -top-6 size-20 rounded-full bg-white/20 blur-xl" />
      <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
        <Sparkles className="size-5" />
      </span>
      <p className="mt-3 font-semibold">Go Pro</p>
      <p className="mt-0.5 text-xs text-white/80">
        Unlock multi-branch reports and priority support.
      </p>
      <Link
        href="/settings"
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white/95 px-3 py-1.5 text-sm font-medium text-violet-700 transition hover:bg-white"
      >
        Upgrade now
      </Link>
    </div>
  );
}
