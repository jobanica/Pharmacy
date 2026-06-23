"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/hris", label: "Overview" },
  { href: "/hris/employees", label: "Employees" },
  { href: "/hris/attendance", label: "Attendance" },
  { href: "/hris/late", label: "Late report" },
  { href: "/hris/timesheets", label: "Timesheets" },
  { href: "/hris/leave", label: "Leave" },
  { href: "/hris/payroll", label: "Payroll" },
];

/** Horizontal section nav shared across the HR management pages. */
export function HrisNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur-xl">
      {SECTIONS.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
