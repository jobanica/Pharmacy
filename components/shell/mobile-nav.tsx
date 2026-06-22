"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-mark";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { ShellFooter } from "@/components/shell/shell-footer";
import type { Role } from "@/lib/auth/roles";

/** Hamburger menu that opens the nav in a drawer on small screens. */
export function MobileNav({
  role,
  plan,
  appName,
  orgName,
}: {
  role: Role;
  plan: string;
  appName: string;
  orgName: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
        }
      />
      <SheetContent side="left" className="dark app-shell flex w-64 flex-col border-white/10 p-0 text-foreground">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <BrandMark className="size-7" />
            {appName}
          </SheetTitle>
          <span className="text-xs text-muted-foreground">{orgName}</span>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
          <SidebarNav role={role} plan={plan} />
        </div>
        <ShellFooter />
      </SheetContent>
    </Sheet>
  );
}
