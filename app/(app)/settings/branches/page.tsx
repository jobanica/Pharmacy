import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canUseMultiBranch } from "@/lib/billing/plans";
import {
  BranchesManager,
  type BranchRow,
} from "@/components/settings/branches-manager";

export const dynamic = "force-dynamic";

export default async function SettingsBranchesPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") redirect("/settings");

  // Pro-only feature: show an upsell to anyone not on Pro.
  if (!canUseMultiBranch(ctx.organization.plan)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Branch management is a Pro feature
          </CardTitle>
          <CardDescription>
            Upgrade to Pro to add and manage multiple branches, each with its own
            staff, stock, and reports (₱500/mo per branch beyond the first).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/settings/billing" />}>
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const [{ data }, { data: saleBranches }, { data: batchBranches }] =
    await Promise.all([
      supabase
        .from("branches")
        .select("id, name, address, phone, is_active")
        .order("created_at", { ascending: true }),
      supabase.from("sales").select("branch_id"),
      supabase.from("batches").select("branch_id"),
    ]);

  // Which branches already carry sales or stock records — used to warn before
  // a delete that would permanently erase them.
  const withHistory = new Set<string>([
    ...(saleBranches ?? []).map((r) => r.branch_id),
    ...(batchBranches ?? []).map((r) => r.branch_id),
  ]);

  const branches: BranchRow[] = (data ?? []).map((b) => ({
    ...b,
    hasHistory: withHistory.has(b.id),
  }));

  return <BranchesManager branches={branches} />;
}
