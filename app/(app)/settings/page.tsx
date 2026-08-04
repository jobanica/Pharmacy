import { OrganizationForm } from "@/components/settings/organization-form";
import { FeatureToggles } from "@/components/settings/feature-toggles";
import { requireAppContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { isRegisterReadingEnabled } from "@/lib/features";

export default async function SettingsOrganizationPage() {
  const ctx = await requireAppContext();

  return (
    <div className="grid gap-6">
      <OrganizationForm
        name={ctx.organization.name}
        role={ROLE_LABELS[ctx.role]}
        branchCount={ctx.branches.length}
        canEdit={ctx.role === "owner"}
      />
      <FeatureToggles
        registerReading={isRegisterReadingEnabled(ctx.organization.settings)}
        canEdit={ctx.role === "owner"}
      />
    </div>
  );
}
