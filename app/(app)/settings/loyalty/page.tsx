import { redirect } from "next/navigation";

import { LoyaltySettings } from "@/components/settings/loyalty-settings";
import { readLoyalty } from "@/lib/loyalty/settings";
import { requireAppContext } from "@/lib/auth/session";

export default async function SettingsLoyaltyPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner" && ctx.role !== "manager") redirect("/settings");

  const loyalty = readLoyalty(ctx.organization.settings);
  return <LoyaltySettings pesoPerPoint={loyalty.pesoPerPoint} />;
}
