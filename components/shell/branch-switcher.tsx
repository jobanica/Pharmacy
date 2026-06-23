"use client";

import { usePathname } from "next/navigation";
import type { BranchSummary } from "@/lib/auth/session";

export function BranchSwitcher({
  branches,
  activeBranchId,
}: {
  branches: BranchSummary[];
  activeBranchId: string;
}) {
  const pathname = usePathname();

  if (branches.length <= 1) {
    return (
      <span className="flex h-9 w-[200px] items-center rounded-md border border-white/20 bg-transparent px-3 text-sm">
        {branches[0]?.name ?? "No branch"}
      </span>
    );
  }

  return (
    <select
      value={activeBranchId}
      onChange={(e) => {
        const id = e.target.value;
        if (id && id !== activeBranchId) {
          window.location.href = `/api/switch-branch?id=${encodeURIComponent(id)}&next=${encodeURIComponent(pathname)}`;
        }
      }}
      className="h-9 w-[200px] rounded-md border border-white/20 bg-transparent px-3 text-sm text-foreground"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id} className="bg-gray-900">
          {b.name}
        </option>
      ))}
    </select>
  );
}
