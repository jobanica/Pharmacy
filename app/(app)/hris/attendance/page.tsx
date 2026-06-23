import { notFound } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HrisNav } from "@/components/hris/hris-nav";
import { ProUpsell } from "@/components/hris/pro-upsell";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { isProPlan } from "@/lib/billing/plans";
import { signAttendancePhotos } from "@/lib/hris/photos";
import { manilaBusinessDay, formatManila } from "@/lib/date";
import type { AttendanceKind } from "@/lib/supabase/types";

export default async function AttendanceByDatePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) notFound();
  if (!isProPlan(ctx.organization.plan)) {
    return (
      <div className="grid gap-6">
        <PageHeader title="Attendance" description="Clock in/out by date." />
        <HrisNav />
        <ProUpsell />
      </div>
    );
  }

  const { date } = await searchParams;
  const day = date ?? manilaBusinessDay();
  const start = new Date(`${day}T00:00:00+08:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const supabase = await createClient();
  const { data: records } = await supabase
    .from("attendance")
    .select("id, kind, photo_path, created_at, user_id, branches(name)")
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString())
    .order("created_at", { ascending: true });

  const userIds = [...new Set((records ?? []).map((r) => r.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const photoUrls = await signAttendancePhotos(
    (records ?? []).map((r) => r.photo_path).filter(Boolean) as string[],
  );

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Attendance"
        description="Every clock in and out captured on a given day."
      />
      <HrisNav />

      <form className="flex items-end gap-3" method="get">
        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={day}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          View
        </button>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Photo</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records && records.length > 0 ? (
              records.map((r) => {
                const url = r.photo_path ? photoUrls.get(r.photo_path) : undefined;
                const isIn = (r.kind as AttendanceKind) === "clock_in";
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="selfie" className="size-10 rounded-lg object-cover" />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-lg bg-white/5 text-[10px] text-muted-foreground">
                          none
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {nameById.get(r.user_id) ?? "—"}
                    </TableCell>
                    <TableCell>
                      {(r as { branches: { name: string } | null }).branches?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={isIn ? "text-teal-300" : "text-muted-foreground"}
                      >
                        {isIn ? <LogIn className="mr-1 size-3" /> : <LogOut className="mr-1 size-3" />}
                        {isIn ? "Clock in" : "Clock out"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatManila(r.created_at, "h:mm a")}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No attendance recorded on {day}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
