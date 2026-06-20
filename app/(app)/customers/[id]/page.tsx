import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Star, Wallet, Receipt as ReceiptIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CustomerDialog, type CustomerRecord } from "@/components/customers/customer-dialog";
import { DeleteCustomerButton } from "@/components/customers/delete-customer";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";
import { formatCentavos } from "@/lib/money";
import { formatManila } from "@/lib/date";
import type { LoyaltyKind } from "@/lib/supabase/types";

const LEDGER_LABEL: Record<LoyaltyKind, string> = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjustment",
};

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAppContext();
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, email, address, birthdate, notes, points_balance, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!customer) notFound();

  const [{ data: sales }, { data: ledger }] = await Promise.all([
    supabase
      .from("sales")
      .select("id, receipt_number, total_centavos, status, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("loyalty_transactions")
      .select("id, kind, points, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const completed = (sales ?? []).filter((s) => s.status === "completed");
  const totalSpent = completed.reduce((s, r) => s + r.total_centavos, 0);
  const canDelete = can(ctx.role, "manage_members");

  const record: CustomerRecord = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    birthdate: customer.birthdate,
    notes: customer.notes,
  };

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Customers
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <div className="flex gap-2">
            <CustomerDialog
              customer={record}
              trigger={
                <Button variant="outline">
                  <Pencil className="size-4" />
                  Edit
                </Button>
              }
            />
            {canDelete ? <DeleteCustomerButton id={customer.id} name={customer.name} /> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Star} label="Points" value={String(customer.points_balance)} />
        <Stat icon={Wallet} label="Total spent" value={formatCentavos(totalSpent)} />
        <Stat icon={ReceiptIcon} label="Visits" value={String(completed.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Phone" value={customer.phone ?? "—"} />
          <Info label="Email" value={customer.email ?? "—"} />
          <Info label="Birthdate" value={customer.birthdate ?? "—"} />
          <Info label="Member since" value={formatManila(customer.created_at, "MMM d, yyyy")} />
          <Info label="Address" value={customer.address ?? "—"} />
          <Info label="Notes" value={customer.notes ?? "—"} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Purchase history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales && sales.length > 0 ? (
                  sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/pos/receipt/${s.id}`} className="font-medium hover:underline">
                          #{s.receipt_number}
                        </Link>
                        {s.status === "voided" ? (
                          <Badge variant="outline" className="ml-2 text-destructive">voided</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatManila(s.created_at, "MMM d, h:mm a")}</TableCell>
                      <TableCell className="text-right">{formatCentavos(s.total_centavos)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">No purchases yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Points history</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger && ledger.length > 0 ? (
                  ledger.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{LEDGER_LABEL[l.kind as LoyaltyKind]}</TableCell>
                      <TableCell className="text-muted-foreground">{formatManila(l.created_at, "MMM d, h:mm a")}</TableCell>
                      <TableCell className={`text-right font-medium ${l.points < 0 ? "text-destructive" : "text-teal-300"}`}>
                        {l.points > 0 ? "+" : ""}{l.points}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">No points activity yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
