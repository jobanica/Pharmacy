import type { Json } from "@/lib/supabase/types";

export type TaxSettings = {
  tin: string;
  businessAddress: string;
  accreditationNo: string;
  permitNo: string;
  atpNo: string;
  vatRatePct: number;
  orPrefix: string;
  orPadding: number;
};

const str = (v: unknown): string =>
  typeof v === "string" && v.trim() ? v.trim() : "";

export function readTax(settings: Json | null | undefined): TaxSettings {
  const root = (settings ?? {}) as { tax?: Record<string, unknown> };
  const t = root.tax ?? {};
  return {
    tin: str(t.tin),
    businessAddress: str(t.business_address),
    accreditationNo: str(t.accreditation_no),
    permitNo: str(t.permit_no),
    atpNo: str(t.atp_no),
    vatRatePct: typeof t.vat_rate_pct === "number" ? t.vat_rate_pct : 12,
    orPrefix: str(t.or_prefix) || "OR",
    orPadding: typeof t.or_padding === "number" ? t.or_padding : 7,
  };
}

/** Compute VAT-inclusive breakdown from a net (total) amount. */
export function vatBreakdown(netCentavos: number, vatRatePct: number) {
  const divisor = 1 + vatRatePct / 100;
  const vatableCentavos = Math.round(netCentavos / divisor);
  const vatCentavos = netCentavos - vatableCentavos;
  return { vatableCentavos, vatCentavos };
}
