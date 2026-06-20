import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { QrCode, LogIn, LogOut } from "lucide-react";

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
import { ProUpsell } from "@/components/hris/pro-upsell";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { isProPlan } from "@/lib/billing/plans";
import { signAttendancePhotos } from "@/lib/hris/photos";
import { formatManila } from "@/lib/date";
import type { AttendanceKind } from "@/lib/supabase/types";

export default async function HrisPage() {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "manage_members")) notFound();
  if (!isProPlan(ctx.organization.plan)) {
    return (
      <div>
        <PageHeader title="Time & Attendance" description="Staff clock in/out with QR + selfie." />
        <ProUpsell />
      </div>
    );
  }

  const supabase = await createClient();
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const [{ data: branches }, { data: records }] = await Promise.all([
    supabase.from("branches").select("id, name, clock_token").eq("is_active", true).order("created_at"),
    supabase
      .from("attendance")
      .select("id, kind, photo_path, created_at, user_id, branches(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // QR posters (one per branch).
  const qrcodes = await Promise.all(
    (branches ?? []).map(async (b) => ({
      name: b.name,
      token: b.clock_token,
      dataUrl: await QRCode.toDataURL(`${origin}/hris/clock?b=${b.clock_token}`, {
        width: 160,
        margin: 1,
      }),
    })),
  );

  // Employee names + signed photo URLs.
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
        title="Time & Attendance"
        description="Staff clock in/out by scanning a branch QR — a selfie is captured for verification."
      />

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <QrCode className="size-4" />
          Clock-in QR posters — print and post at each branch
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {qrcodes.map((q) => (
            <div key={q.token} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.dataUrl} alt={`QR for ${q.name}`} className="mx-auto rounded-lg bg-white p-2" width={160} height={160} />
              <p className="mt-3 font-medium">{q.name}</p>
              <Link href={`/hris/clock?b=${q.token}`} className="text-xs text-fuchsia-300 hover:underline">
                Open clock page →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent attendance</h2>
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
                      <TableCell className="font-medium">{nameById.get(r.user_id) ?? "—"}</TableCell>
                      <TableCell>{(r as { branches: { name: string } | null }).branches?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={isIn ? "text-teal-300" : "text-muted-foreground"}>
                          {isIn ? <LogIn className="mr-1 size-3" /> : <LogOut className="mr-1 size-3" />}
                          {isIn ? "Clock in" : "Clock out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatManila(r.created_at)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                    No attendance yet. Have staff scan a branch QR to clock in.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
