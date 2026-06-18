import Link from "next/link";
import { Pill } from "lucide-react";

import { publicEnv } from "@/lib/env";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Link href="/" className="mb-6 flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Pill className="size-4" />
        </span>
        {publicEnv.NEXT_PUBLIC_APP_NAME}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
