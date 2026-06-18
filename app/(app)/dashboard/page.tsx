import { CalendarDays, Coins, Building2, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAppContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { formatManila, manilaBusinessDay } from "@/lib/date";

export default async function DashboardPage() {
  const ctx = await requireAppContext();

  // Foundation smoke test: prove the money + date helpers render correctly.
  const sampleRevenueCentavos = 1_234_550; // ₱12,345.50

  const facts = [
    {
      icon: Building2,
      label: "Organization",
      value: ctx.organization.name,
      hint: `Role: ${ROLE_LABELS[ctx.role]}`,
    },
    {
      icon: Coins,
      label: "Currency formatting",
      value: formatCentavos(sampleRevenueCentavos),
      hint: "Stored as integer centavos (PHP)",
    },
    {
      icon: CalendarDays,
      label: "Manila business day",
      value: manilaBusinessDay(),
      hint: formatManila(new Date()),
    },
    {
      icon: ShieldCheck,
      label: "Active branch",
      value:
        ctx.branches.find((b) => b.id === ctx.activeBranchId)?.name ??
        "Main Branch",
      hint: `${ctx.branches.length} branch(es) accessible`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Foundation is ready. Sales metrics and charts arrive in Milestone 8."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {f.label}
                </CardTitle>
                <Icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="truncate text-2xl font-semibold">{f.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{f.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
