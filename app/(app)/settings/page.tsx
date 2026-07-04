import { OrganizationForm } from "@/components/settings/organization-form";
import { requireAppContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";

export default async function SettingsOrganizationPage() {
  const ctx = await requireAppContext();

  return (
    <OrganizationForm
      name={ctx.organization.name}
      role={ROLE_LABELS[ctx.role]}
      branchCount={ctx.branches.length}
      canEdit={ctx.role === "owner"}
    />
  );
}
