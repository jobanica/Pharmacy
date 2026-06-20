import { Users, Gift } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CustomersTable, type CustomerRow } from "@/components/customers/customers-table";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function CustomersPage() {
  await requireAppContext();
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address, birthdate, notes, points_balance, created_at")
    .order("created_at", { ascending: false });

  const rows = (customers ?? []) as CustomerRow[];
  const totalPoints = rows.reduce((s, c) => s + c.points_balance, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Customers"
        description="Your customer database. Save contact details and track loyalty points."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icon={Users} label="Customers" value={rows.length.toLocaleString()} gradient="from-violet-500 to-purple-600" />
        <Stat icon={Gift} label="Points outstanding" value={totalPoints.toLocaleString()} gradient="from-amber-400 to-orange-500" />
      </div>

      <CustomersTable rows={rows} />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  gradient: string;
}) {
  return (
    <Card className={`relative overflow-hidden border-0 bg-gradient-to-br ${gradient} text-white`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/90">{label}</span>
          <Icon className="size-5" />
        </div>
        <div className="mt-2 text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
