"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Branch = { id: string; name: string };

export function DashboardFilters({
  branches,
  allowAll,
  from,
  to,
  branch,
}: {
  branches: Branch[];
  allowAll: boolean;
  from: string;
  to: string;
  branch: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(patch: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`/dashboard?${next.toString()}`);
  }

  function preset(days: number) {
    const end = new Date();
    const start = new Date(Date.now() - (days - 1) * 86_400_000);
    setParam({
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => preset(7)}>7d</Button>
        <Button variant="outline" size="sm" onClick={() => preset(30)}>30d</Button>
        <Button variant="outline" size="sm" onClick={() => preset(90)}>90d</Button>
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">From</span>
        <Input type="date" value={from} onChange={(e) => setParam({ from: e.target.value })} className="h-9 w-40" />
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">To</span>
        <Input type="date" value={to} onChange={(e) => setParam({ to: e.target.value })} className="h-9 w-40" />
      </div>
      {branches.length > 1 || allowAll ? (
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Branch</span>
          <select
            value={branch}
            onChange={(e) => setParam({ branch: e.target.value })}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {allowAll ? <option value="all">All branches</option> : null}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}
