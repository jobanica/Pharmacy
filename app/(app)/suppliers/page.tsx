import { PageHeader } from "@/components/shell/page-header";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import type { SupplierRow } from "@/components/suppliers/supplier-dialog";
import { requireAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/auth/roles";

export default async function SuppliersPage() {
  const ctx = await requireAppContext();
  const supabase = await createClient();
  const canManage = can(ctx.role, "manage_catalog");

  const { data } = await supabase
    .from("suppliers")
    .select("id, name, contact_person, phone, email, address, notes")
    .order("name", { ascending: true });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Your supplier directory. Purchase orders arrive in Milestone 7."
      />
      <SuppliersTable
        suppliers={(data ?? []) as SupplierRow[]}
        canManage={canManage}
      />
    </div>
  );
}
