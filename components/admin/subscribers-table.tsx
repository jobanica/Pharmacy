"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ExternalLink, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setOrgPlan, setOrgStatus } from "@/lib/admin/actions";
import { formatCentavos } from "@/lib/money";

export type Subscriber = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
  members: number;
  branches: number;
  sales: number;
  revenueCentavos: number;
  monthlyPriceCentavos: number;
};

const PLANS = ["free", "starter", "pro"] as const;

export function SubscribersTable({ subscribers }: { subscribers: Subscriber[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  const rows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subscribers;
    return subscribers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    );
  }, [subscribers, search]);

  function changePlan(orgId: string, plan: string) {
    setBusy(orgId);
    setOrgPlan({ orgId, plan: plan as (typeof PLANS)[number] }).then((res) => {
      setBusy(null);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Plan updated");
        router.refresh();
      }
    });
  }

  function toggleStatus(orgId: string, current: string) {
    const status = current === "active" ? "suspended" : "active";
    setBusy(orgId);
    setOrgStatus({ orgId, status }).then((res) => {
      setBusy(null);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success(status === "active" ? "Subscriber reactivated" : "Subscriber suspended");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search subscribers…"
        className="h-9 w-full max-w-xs rounded-md border bg-transparent px-3 text-sm"
      />
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subscriber</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Branches</TableHead>
              <TableHead className="text-right">Sales</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} className={s.status !== "active" ? "opacity-60" : ""}>
                <TableCell>
                  <div className="font-medium">{s.name}</div>
                  <a
                    href={`/store/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    /{s.slug}
                    <ExternalLink className="size-3" />
                  </a>
                </TableCell>
                <TableCell>
                  <select
                    value={s.plan}
                    disabled={busy === s.id}
                    onChange={(e) => changePlan(s.id, e.target.value)}
                    className="h-8 rounded-md border bg-transparent px-2 text-sm capitalize"
                  >
                    {PLANS.map((p) => (
                      <option key={p} value={p} className="capitalize">
                        {p}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell>
                  {s.status === "active" ? (
                    <Badge variant="secondary" className="text-emerald-400">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-destructive capitalize">{s.status}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">{s.members}</TableCell>
                <TableCell className="text-right">{s.branches}</TableCell>
                <TableCell className="text-right">{s.sales}</TableCell>
                <TableCell className="text-right">{formatCentavos(s.revenueCentavos)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === s.id}
                    className={s.status === "active" ? "text-destructive" : "text-emerald-400"}
                    onClick={() => toggleStatus(s.id, s.status)}
                  >
                    {busy === s.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : s.status === "active" ? (
                      <Ban className="size-4" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    {s.status === "active" ? "Suspend" : "Reactivate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No subscribers found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
