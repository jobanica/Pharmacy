import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { publicEnv } from "@/lib/env";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dark app-shell flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-12 text-foreground">
      <Link href="/" className="mb-6 flex items-center gap-2 font-semibold">
        <BrandMark className="size-8" />
        {publicEnv.NEXT_PUBLIC_APP_NAME}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
