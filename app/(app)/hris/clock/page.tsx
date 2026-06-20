import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TimeClock } from "@/components/hris/time-clock";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isProPlan } from "@/lib/billing/plans";
import { ProUpsell } from "@/components/hris/pro-upsell";

export default async function ClockPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const ctx = await requireAppContext();
  if (!isProPlan(ctx.organization.plan)) return <ProUpsell />;

  const { b: token } = await searchParams;
  const supabase = await createClient();

  let branchId = ctx.activeBranchId;
  let branchName =
    ctx.branches.find((br) => br.id === ctx.activeBranchId)?.name ?? "Branch";

  if (token) {
    const { data: branch } = await supabase
      .from("branches")
      .select("id, name")
      .eq("clock_token", token)
      .maybeSingle();
    if (branch) {
      branchId = branch.id;
      branchName = branch.name;
    }
  }

  return (
    <div>
      <Link
        href="/hris"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Time & attendance
      </Link>
      <TimeClock branchId={branchId} branchName={branchName} userName={ctx.user.fullName} />
    </div>
  );
}
