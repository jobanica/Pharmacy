import { PageHeader } from "@/components/shell/page-header";
import { SettingsNav, type SettingsSection } from "@/components/settings/settings-nav";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAppContext();
  const isOwner = ctx.role === "owner";
  const canManageMembers = can(ctx.role, "manage_members");
  const canManageLoyalty = ctx.role === "owner" || ctx.role === "manager";

  const sections: SettingsSection[] = [
    { href: "/settings", label: "Organization" },
    { href: "/settings/members", label: "Members" },
    ...(canManageMembers ? [{ href: "/settings/invite", label: "Invite teammate" }] : []),
    ...(isOwner ? [{ href: "/settings/branches", label: "Branches" }] : []),
    ...(isOwner ? [{ href: "/settings/tax", label: "Tax & receipts" }] : []),
    ...(isOwner ? [{ href: "/settings/branding", label: "Branding & printer" }] : []),
    ...(isOwner ? [{ href: "/settings/domain", label: "Custom domain" }] : []),
    ...(canManageLoyalty ? [{ href: "/settings/loyalty", label: "Loyalty" }] : []),
    ...(isOwner ? [{ href: "/settings/billing", label: "Billing" }] : []),
  ];

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description="Organization, team members, receipts, and billing."
      />
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <aside className="md:sticky md:top-0 md:self-start">
          <SettingsNav sections={sections} />
        </aside>
        <div className="min-w-0 grid gap-6">{children}</div>
      </div>
    </div>
  );
}
