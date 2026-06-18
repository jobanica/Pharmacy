"use client";

import * as React from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { BranchSummary } from "@/lib/auth/session";

/**
 * Branch switcher. In Milestone 2 selecting a branch persists the active branch
 * (cookie/server action) and refreshes branch-scoped data. For now it holds
 * local state so the control is interactive in the shell.
 */
export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: BranchSummary[];
  activeBranchId: string;
}) {
  const [active, setActive] = React.useState(activeBranchId);
  const current = branches.find((b) => b.id === active) ?? branches[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="w-[200px] justify-between" />}
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
            onSelect={() => setActive(branch.id)}
            className="justify-between"
          >
            {branch.name}
            {branch.id === active ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
