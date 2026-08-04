import { notFound } from "next/navigation";

import { StorefrontSettings } from "@/components/settings/storefront-settings";
import { requireAppContext } from "@/lib/auth/session";
import { readStorefront } from "@/lib/storefront/settings";

export default async function StorefrontSettingsPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") notFound();

  return <StorefrontSettings initial={readStorefront(ctx.organization.settings)} />;
}
