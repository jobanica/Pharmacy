import { redirect } from "next/navigation";

import { TaxSettingsCard } from "@/components/settings/tax-settings";
import { readTax } from "@/lib/tax/settings";
import { requireAppContext } from "@/lib/auth/session";

export default async function SettingsTaxPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") redirect("/settings");

  const tax = readTax(ctx.organization.settings);
  return <TaxSettingsCard tax={tax} />;
}
