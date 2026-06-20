import Link from "next/link";
import { Clock, Lock, QrCode, Camera, Check } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Shown when an org on a non-Pro plan opens an HRIS page. */
export function ProUpsell() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-violet-600/15 to-fuchsia-500/10 p-8 text-center backdrop-blur-xl">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
        <Lock className="size-6" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">Time &amp; Attendance is a Pro feature</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Track staff hours with QR clock in/out and selfie verification. Upgrade
        to Pro to switch it on for your pharmacy.
      </p>
      <ul className="mx-auto mt-5 grid max-w-xs gap-2 text-left text-sm">
        {[
          { icon: QrCode, t: "Per-branch QR clock-in posters" },
          { icon: Camera, t: "Selfie verification at clock time" },
          { icon: Clock, t: "Timesheets with hours worked" },
        ].map((f) => (
          <li key={f.t} className="flex items-center gap-2">
            <Check className="size-4 text-teal-300" />
            {f.t}
          </li>
        ))}
      </ul>
      <Button className="mt-6" render={<Link href="/settings" />}>
        Upgrade to Pro
      </Button>
    </div>
  );
}
