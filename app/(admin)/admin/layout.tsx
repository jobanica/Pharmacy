import Link from "next/link";
import { ShieldCheck, ArrowLeft } from "lucide-react";

import { requirePlatformAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div className="dark app-shell min-h-screen text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5 text-primary" />
          Platform Admin
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-muted-foreground sm:inline">{admin.email}</span>
          <Link href="/dashboard" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
