"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { can, type Role } from "@/lib/auth/roles";
import { isStarterPlan, isProPlan } from "@/lib/billing/plans";

export function SidebarNav({ role, plan }: { role: Role; plan: string }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => {
    if (item.requires && !can(role, item.requires)) return false;
    if (item.requiresPlan === "starter" && !isStarterPlan(plan)) return false;
    if (item.requiresPlan === "pro" && !isProPlan(plan)) return false;
    return true;
  });

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-700/30"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
