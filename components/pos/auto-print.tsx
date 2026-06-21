"use client";

import * as React from "react";

/** Triggers the print dialog once on mount when receipt auto-print is enabled. */
export function AutoPrint({ enabled }: { enabled: boolean }) {
  React.useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [enabled]);
  return null;
}
