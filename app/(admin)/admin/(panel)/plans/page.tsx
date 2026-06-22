import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getPlans } from "@/lib/billing/get-plans";
import { PlanEditor } from "@/components/admin/plan-editor";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  await requirePlatformAdmin();
  const plans = await getPlans();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Plans</h1>
        <p className="text-sm text-muted-foreground">
          Edit the name, price, description, and features of each tier. Changes
          apply immediately to the pricing page and customer billing screen.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <PlanEditor key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}
