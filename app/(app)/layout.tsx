import Link from "next/link";

import { requireAppContext } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { BrandMark } from "@/components/brand/brand-mark";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { BranchSwitcher } from "@/components/shell/branch-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { MobileNav } from "@/components/shell/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAppContext();

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-[256px_1fr] md:grid-rows-1">
      {/* Sidebar */}
      <aside className="hidden border-r bg-card md:flex md:flex-col">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 border-b px-5 py-4"
        >
          <BrandMark className="size-8" />
          <span className="font-semibold">{publicEnv.NEXT_PUBLIC_APP_NAME}</span>
        </Link>
        <div className="border-b px-5 py-2 text-xs text-muted-foreground">
          {ctx.organization.name}
        </div>
        <SidebarNav role={ctx.role} />
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between gap-4 border-b bg-card px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <MobileNav
              role={ctx.role}
              appName={publicEnv.NEXT_PUBLIC_APP_NAME}
              orgName={ctx.organization.name}
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
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
