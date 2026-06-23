"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

import { setActiveBranchAction } from "@/lib/auth/actions";

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

/**
 * Branch switcher. Selecting a branch persists it via a server action (cookie)
 * and refreshes branch-scoped data. Single-branch users get a static label.
 */
export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: BranchSummary[];
  activeBranchId: string;
}) {
  const router = useRouter();
  const [active, setActive] = React.useState(activeBranchId);
  const [isPending, startTransition] = React.useTransition();
  const current = branches.find((b) => b.id === active) ?? branches[0];

  // Keep local state in sync if the active branch changes server-side.
  React.useEffect(() => setActive(activeBranchId), [activeBranchId]);

  function selectBranch(branchId: string) {
    if (branchId === active) return;
    setActive(branchId);
    startTransition(async () => {
      await setActiveBranchAction(branchId);
      // Hard reload is more reliable than router.refresh() across browsers —
      // avoids the RSC fetch occasionally failing mid-transition.
      window.location.reload();
    });
  }

  if (branches.length <= 1) {
    return (
      <span className="flex h-9 w-[200px] items-center gap-2 rounded-md border px-3 text-sm">
        <Building2 className="size-4 shrink-0" />
        <span className="truncate">{current?.name ?? "No branch"}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={isPending}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-[200px] justify-between",
            )}
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
            onSelect={() => selectBranch(branch.id)}
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
