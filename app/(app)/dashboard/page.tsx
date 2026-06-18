import Link from "next/link";
import { PackageX, CalendarClock, AlertTriangle, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const branchName =
    ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ?? "branch";

  const [{ count: lowCount }, { data: expiring }] = await Promise.all([
    supabase
      .from("v_low_stock")
      .select("product_id", { count: "exact", head: true })
      .eq("branch_id", ctx.activeBranchId),
    supabase
      .from("v_expiring_batches")
      .select("days_until")
      .eq("branch_id", ctx.activeBranchId),
  ]);

  const exp = expiring ?? [];
  const expired = exp.filter((r) => (r.days_until ?? 0) < 0).length;
  const soon = exp.filter((r) => (r.days_until ?? 0) >= 0 && (r.days_until ?? 0) <= 30).length;

  const cards = [
    { icon: AlertTriangle, label: "Low stock", value: lowCount ?? 0, hint: "At/below reorder point" },
    { icon: PackageX, label: "Expired batches", value: expired, hint: "Write off in Alerts" },
    { icon: CalendarClock, label: "Expiring ≤30 days", value: soon, hint: "Act soon" },
    { icon: CalendarClock, label: "Expiring ≤90 days", value: exp.length, hint: "Total upcoming" },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${branchName} at a glance. Sales metrics and charts arrive in Milestone 8.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{c.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Link
        href="/alerts"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        View all alerts
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
