"use client";

import * as React from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="size-4" />
      Print
    </Button>
  );
}

/** Plain underlined "Print now" link for inline use in text. */
export function PrintLink({ children = "Print now" }: { children?: React.ReactNode }) {
  return (
    <button onClick={() => window.print()} className="underline">
      {children}
    </button>
  );
}
