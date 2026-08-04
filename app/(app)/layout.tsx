import type React from "react";
import Link from "next/link";

import { requireAppContext } from "@/lib/auth/session";
import { BrandMark } from "@/components/brand/brand-mark";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { MobileNav } from "@/components/shell/mobile-nav";
import { UpgradeCard } from "@/components/shell/upgrade-card";
import { ShellFooter } from "@/components/shell/shell-footer";
import { isRegisterReadingEnabled } from "@/lib/features";
import { getPlatformAdmin } from "@/lib/admin/auth";
import { readBrand } from "@/lib/branding";
import { NewOrderWatcher } from "@/components/orders/new-order-watcher";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAppContext();
  const brand = readBrand(ctx.organization.settings);
  const registerReading = isRegisterReadingEnabled(ctx.organization.settings);
  const isPlatformAdmin = Boolean(await getPlatformAdmin());

  const brandStyle = brand.brandColor
    ? ({ "--brand": brand.brandColor } as React.CSSProperties)
    : undefined;

  return (
    <div
      className="dark app-shell grid h-screen grid-rows-[auto_1fr] overflow-hidden text-foreground md:grid-cols-[260px_1fr] md:grid-rows-1"
      style={brandStyle}
    >
      <NewOrderWatcher orgId={ctx.organization.id} />
      {/* Sidebar */}
      <aside className="hidden border-r border-white/10 bg-white/[0.04] backdrop-blur-xl md:flex md:h-screen md:flex-col md:overflow-hidden">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 px-5 py-5"
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
        <div className="shrink-0 px-5 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
          {ctx.organization.name}
        </div>
        {/* Only the nav scrolls; the upgrade card + footer stay pinned. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav role={ctx.role} plan={ctx.organization.plan} registerReading={registerReading} />
        </div>
        <div className="shrink-0 p-3">
          <UpgradeCard />
        </div>
        <div className="shrink-0">
          <ShellFooter isPlatformAdmin={isPlatformAdmin} />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-col overflow-hidden md:h-screen">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <MobileNav
              role={ctx.role}
              plan={ctx.organization.plan}
              registerReading={registerReading}
              appName={brand.name}
              orgName={ctx.organization.name}
              isPlatformAdmin={isPlatformAdmin}
            />
            <BranchSwitcher
              branches={ctx.branches}
              activeBranchId={ctx.activeBranchId}
            />
          </div>
          <UserMenu
            fullName={ctx.user.fullName}
            email={ctx.user.email}
            role={ctx.role}
          />
        </header>
        {ctx.user.email?.endsWith("@placeholder.reseta.ph") ? (
          <div className="shrink-0 flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-sm text-amber-300 md:px-6">
            <span>Your account setup is not complete. Please set your email and password.</span>
            <a href="/setup" className="shrink-0 font-medium underline underline-offset-2">
              Complete setup →
            </a>
          </div>
        ) : null}
        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
