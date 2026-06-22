import { PageHeader } from "@/components/shell/page-header";
import { InteractionForm, InteractionsList } from "@/components/clinical/interaction-form";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";

export default async function InteractionsPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "manage_catalog");

  const [{ data: products }, { data: interactions }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, generic_name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("drug_interactions")
      .select("id, product_id_a, product_id_b, severity, description")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Drug Interactions"
        description="Pairs registered here trigger a warning at the POS when both drugs are in the same cart."
      />

      {canManage ? (
        <InteractionForm products={products ?? []} />
      ) : null}

      <InteractionsList
        interactions={interactions ?? []}
        products={products ?? []}
      />
    </div>
  );
}
