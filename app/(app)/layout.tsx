import Link from "next/link";

import { requireAppContext } from "@/lib/auth/session";
import { BrandMark } from "@/components/brand/brand-mark";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { MobileNav } from "@/components/shell/mobile-nav";
import { UpgradeCard } from "@/components/shell/upgrade-card";
import { ShellFooter } from "@/components/shell/shell-footer";
import { getPlatformAdmin } from "@/lib/admin/auth";
import { readBrand } from "@/lib/branding";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAppContext();
  const brand = readBrand(ctx.organization.settings);
  const isPlatformAdmin = Boolean(await getPlatformAdmin());

  const supabase = await createClient();
  const { data: recentNotifs } = await supabase
    .from("notifications")
    .select("id, type, title, body, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const notifications = recentNotifs ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="dark app-shell grid min-h-screen grid-rows-[auto_1fr] text-foreground md:grid-cols-[260px_1fr] md:grid-rows-1">
      {/* Sidebar */}
      <aside className="hidden border-r border-white/10 bg-white/[0.04] backdrop-blur-xl md:flex md:flex-col">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-5 py-5"
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="size-8 rounded-lg bg-white object-contain p-0.5" />
          ) : (
            <BrandMark className="size-8" />
          )}
          <span className="text-lg font-semibold tracking-tight">
            {brand.name}
          </span>
        </Link>
        <div className="px-5 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
          {ctx.organization.name}
        </div>
        <SidebarNav role={ctx.role} plan={ctx.organization.plan} />
        <div className="mt-auto p-3">
          <UpgradeCard />
        </div>
        <ShellFooter isPlatformAdmin={isPlatformAdmin} />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <MobileNav
              role={ctx.role}
              plan={ctx.organization.plan}
              appName={brand.name}
              orgName={ctx.organization.name}
              isPlatformAdmin={isPlatformAdmin}
            />
            <BranchSwitcher
              branches={ctx.branches}
              activeBranchId={ctx.activeBranchId}
            />
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell notifications={notifications} unreadCount={unreadCount} />
            <UserMenu
              fullName={ctx.user.fullName}
              email={ctx.user.email}
              role={ctx.role}
            />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
