"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { usePathname } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BranchSummary } from "@/lib/auth/session";

export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: BranchSummary[];
  activeBranchId: string;
}) {
  const pathname = usePathname();
  const current = branches.find((b) => b.id === activeBranchId) ?? branches[0];

  if (branches.length <= 1) {
    return (
      <span className="flex h-9 w-[200px] items-center gap-2 rounded-md border px-3 text-sm">
        <Building2 className="size-4 shrink-0" />
        <span className="truncate">{current?.name ?? "No branch"}</span>
      </span>
    );
  }

  function switchTo(branchId: string) {
    if (branchId === activeBranchId) return;
    window.location.href = `/api/switch-branch?id=${encodeURIComponent(branchId)}&next=${encodeURIComponent(pathname)}`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "w-[200px] justify-between")}
          />
        }
      >
        <span className="flex items-center gap-2 truncate">
          <Building2 className="size-4 shrink-0" />
          <span className="truncate">{current?.name ?? "No branch"}</span>
        </span>
        <ChevronsUpDown className="size-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuLabel>Switch branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => switchTo(branch.id)}
            className="justify-between"
          >
            {branch.name}
            {branch.id === activeBranchId ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
