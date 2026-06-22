import { Building2, CheckCircle2, Wallet, MessageSquare } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubscribersTable } from "@/components/admin/subscribers-table";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAdminOverview, getRecentFeedback } from "@/lib/admin/data";
import { formatCentavos } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const [{ subscribers, stats }, feedback] = await Promise.all([
    getAdminOverview(),
    getRecentFeedback(30),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscribers</h1>
        <p className="text-sm text-muted-foreground">
          Manage every pharmacy on Reseta — plans, status, and usage.
        </p>
      </div>

      {/* Platform stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Building2 className="size-5" />} label="Total subscribers" value={String(stats.totalOrgs)} />
        <Stat icon={<CheckCircle2 className="size-5" />} label="Active" value={String(stats.activeOrgs)} />
        <Stat
          icon={<Wallet className="size-5" />}
          label="Est. MRR"
          value={formatCentavos(stats.mrrCentavos)}
          hint="Sum of active plan prices"
        />
        <Stat
          icon={<MessageSquare className="size-5" />}
          label="Feedback"
          value={String(feedback.length)}
          hint="Recent messages"
        />
      </div>

      {/* Plan breakdown */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="outline">Free: {stats.byPlan.free}</Badge>
        <Badge variant="outline" className="text-sky-400">Starter: {stats.byPlan.starter}</Badge>
        <Badge variant="outline" className="text-violet-400">Pro: {stats.byPlan.pro}</Badge>
      </div>

      <SubscribersTable subscribers={subscribers} />

      {/* Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Recent feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No feedback yet.</p>
          ) : (
            <div className="divide-y">
              {feedback.map((f) => (
                <div key={f.id} className="grid gap-1 py-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">{f.category}</Badge>
                    <span>{f.orgName ?? "—"}</span>
                    {f.userEmail ? <span>· {f.userEmail}</span> : null}
                    <span className="ml-auto">{new Date(f.createdAt).toLocaleDateString("en-PH")}</span>
                  </div>
                  <p className="whitespace-pre-line text-sm">{f.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-white/5 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="truncate text-lg font-semibold">{value}</div>
          {hint ? <div className="text-[10px] text-muted-foreground">{hint}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
