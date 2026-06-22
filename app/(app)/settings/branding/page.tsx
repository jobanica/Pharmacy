import { redirect } from "next/navigation";

import { BrandingSettings } from "@/components/settings/branding-settings";
import { readBrand } from "@/lib/branding";
import { publicEnv } from "@/lib/env";
import { requireAppContext } from "@/lib/auth/session";

export default async function SettingsBrandingPage() {
  const ctx = await requireAppContext();
  if (ctx.role !== "owner") redirect("/settings");

  const brand = readBrand(ctx.organization.settings);
  return (
    <BrandingSettings
      appName={publicEnv.NEXT_PUBLIC_APP_NAME}
      brandName={brand.name}
      logoUrl={brand.logoUrl}
      header={brand.receipt.header ?? ""}
      footer={brand.receipt.footer ?? ""}
      paper={brand.receipt.paper}
      autoPrint={brand.receipt.autoPrint}
      printerType={brand.receipt.printerType}
    />
  );
}
