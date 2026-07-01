import { PageHeader } from "@/components/shell/page-header";
import { PrinterDeviceSettings } from "@/components/settings/printer-device-settings";
import { requireAppContext } from "@/lib/auth/session";
import { readBrand } from "@/lib/branding";

export default async function PrinterSettingsPage() {
  const ctx = await requireAppContext();
  const brand = readBrand(ctx.organization.settings, ctx.organization.name);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Printer settings"
        description="Set up the receipt printer for this device."
      />
      <PrinterDeviceSettings
        defaultPrinterType={brand.receipt.printerType}
        defaultPaper={brand.receipt.paper}
        defaultAutoPrint={brand.receipt.autoPrint}
      />
    </div>
  );
}
