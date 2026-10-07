"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { retryPortalEvent } from "@/lib/admin/actions";
import type { PortalEventRow } from "@/lib/admin/portal-data";

/**
 * Events the portal refused, or that could never be sent as written. Retrying
 * puts one back in the queue; the next cron tick picks it up.
 */
export function PortalQueueTable({ failed }: { failed: PortalEventRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  function retry(id: string) {
    setBusy(id);
    retryPortalEvent(id).then((res) => {
      setBusy(null);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Queued for retry");
        router.refresh();
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Pharmacy</TableHead>
            <TableHead>Event</TableHead>
            <TableHead className="text-right">Attempts</TableHead>
            <TableHead>Last error</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {failed.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <div className="font-medium">{e.orgName ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString("en-PH", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Manila",
                  })}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-mono text-xs">{e.type}</div>
                <div className="font-mono text-[11px] text-muted-foreground">{e.eventId}</div>
              </TableCell>
              <TableCell className="text-right">{e.attempts}</TableCell>
              <TableCell className="max-w-xs">
                <span className="text-xs text-muted-foreground">
                  {e.lastStatus ? `HTTP ${e.lastStatus} — ` : ""}
                  {e.lastError ?? "—"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === e.id}
                  onClick={() => retry(e.id)}
                >
                  {busy === e.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Retry
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {failed.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                Nothing has failed. Every event reached the portal.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
