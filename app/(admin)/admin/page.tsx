import { Building2, CheckCircle2, Wallet, MessageSquare } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAdminOverview, getRecentFeedback } from "@/lib/admin/data";
import { formatCentavos } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requirePlatformAdmin();
  const [{ stats }, feedback] = await Promise.all([
    getAdminOverview(),
    getRecentFeedback(5),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform health at a glance.</p>
      </div>

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

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground text-sm">By plan:</span>
        <Badge variant="outline">Free: {stats.byPlan.free}</Badge>
        <Badge variant="outline" className="text-sky-400">Starter: {stats.byPlan.starter}</Badge>
        <Badge variant="outline" className="text-violet-400">Pro: {stats.byPlan.pro}</Badge>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
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
