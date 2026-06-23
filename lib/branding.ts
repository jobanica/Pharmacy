import { publicEnv } from "@/lib/env";
import type { Json } from "@/lib/supabase/types";

export type ReceiptPaper = "58mm" | "80mm" | "A4";

export type PrinterType = "bluetooth" | "browser";

export type Brand = {
  name: string;
  logoUrl: string | null;
  receipt: {
    header: string | null;
    footer: string | null;
    paper: ReceiptPaper;
    autoPrint: boolean;
    printerType: PrinterType;
  };
};

export function logoPublicUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/${path}`;
}

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

/** Parse an organization's jsonb settings into typed branding/receipt config. */
export function readBrand(settings: Json | null | undefined, fallbackName?: string): Brand {
  const root = (settings ?? {}) as {
    branding?: {
      brand_name?: unknown;
      logo_path?: unknown;
      receipt?: { header?: unknown; footer?: unknown; paper?: unknown; auto_print?: unknown; printer_type?: unknown };
    };
  };
  const b = root.branding ?? {};
  const r = b.receipt ?? {};
  const paper =
    r.paper === "58mm" || r.paper === "A4" ? (r.paper as ReceiptPaper) : "80mm";
  const printerType: PrinterType = r.printer_type === "bluetooth" ? "bluetooth" : "browser";
  const logo = str(b.logo_path);

  return {
    name: str(b.brand_name) ?? fallbackName ?? publicEnv.NEXT_PUBLIC_APP_NAME,
    logoUrl: logo ? logoPublicUrl(logo) : null,
    receipt: {
      header: str(r.header),
      footer: str(r.footer),
      paper,
      autoPrint: r.auto_print === true,
      printerType,
    },
  };
}

export const PAPER_WIDTHS: Record<ReceiptPaper, string> = {
  "58mm": "max-w-[220px]",
  "80mm": "max-w-[320px]",
  A4: "max-w-[640px]",
};
