import { Star, Users, Gift } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddCustomerButton } from "@/components/loyalty/add-customer";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatManila } from "@/lib/date";

export default async function CustomersPage() {
  await requireAppContext();
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, points_balance, created_at")
    .order("points_balance", { ascending: false });

  const rows = customers ?? [];
  const totalMembers = rows.length;
  const totalPoints = rows.reduce((s, c) => s + c.points_balance, 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Loyalty & Rewards"
        description="Members earn 1 point per ₱20 spent. Points redeem as ₱1 each at checkout."
        action={<AddCustomerButton />}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat icon={Users} label="Members" value={String(totalMembers)} gradient="from-violet-500 to-purple-600" />
        <Stat icon={Gift} label="Points outstanding" value={totalPoints.toLocaleString()} gradient="from-amber-400 to-orange-500" />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatManila(c.created_at, "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-300">
                      <Star className="size-3.5" />
                      {c.points_balance}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No members yet. Add one here or at the POS during checkout.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: typeof Star;
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
