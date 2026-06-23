"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Triggers the browser print dialog; the page's print CSS handles layout. */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
