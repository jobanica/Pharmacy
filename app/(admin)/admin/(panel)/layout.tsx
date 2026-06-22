import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

import { requirePlatformAdmin } from "@/lib/admin/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="dark app-shell grid h-screen grid-rows-[auto_1fr] overflow-hidden text-foreground md:grid-cols-[220px_1fr] md:grid-rows-1">
      {/* Sidebar */}
      <aside className="hidden border-r border-white/10 bg-white/[0.04] md:flex md:h-screen md:flex-col md:overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 px-5 py-5 font-semibold">
          <ShieldCheck className="size-5 text-primary" />
          Platform Admin
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <AdminNav />
        </div>
        <div className="shrink-0 border-t border-white/10 px-5 py-3">
          <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
          <Link
            href="/dashboard"
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Back to app
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-col overflow-hidden md:h-screen">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 md:hidden">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            Platform Admin
          </div>
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
