import { publicEnv } from "@/lib/env";
import type { Json } from "@/lib/supabase/types";

export type PayMethod = { enabled: boolean; name: string; number: string };
export type BankMethod = { enabled: boolean; bankName: string; name: string; number: string };

export type Storefront = {
  deliveryFeeCentavos: number;
  qrPath: string | null;
  qrUrl: string | null;
  gcash: PayMethod;
  maya: PayMethod;
  bank: BankMethod;
};

export function storefrontQrUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/${path}`;
}

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const b = (v: unknown): boolean => v === true;
const n = (v: unknown): number => (typeof v === "number" && v >= 0 ? Math.round(v) : 0);

/** Parse an organization's jsonb settings into typed storefront config. */
export function readStorefront(settings: Json | null | undefined): Storefront {
  const root = (settings ?? {}) as { storefront?: Record<string, unknown> };
  const sf = root.storefront ?? {};
  const gcash = (sf.gcash ?? {}) as Record<string, unknown>;
  const maya = (sf.maya ?? {}) as Record<string, unknown>;
  const bank = (sf.bank ?? {}) as Record<string, unknown>;
  const qrPath = s(sf.qr_path) || null;

  return {
    deliveryFeeCentavos: n(sf.delivery_fee_centavos),
    qrPath,
    qrUrl: qrPath ? storefrontQrUrl(qrPath) : null,
    gcash: { enabled: b(gcash.enabled), name: s(gcash.name), number: s(gcash.number) },
    maya: { enabled: b(maya.enabled), name: s(maya.name), number: s(maya.number) },
    bank: {
      enabled: b(bank.enabled),
      bankName: s(bank.bank_name),
      name: s(bank.name),
      number: s(bank.number),
    },
  };
}

/** True when the customer has at least one online-payment method to pay with. */
export function hasOnlinePayment(sf: Storefront): boolean {
  return sf.gcash.enabled || sf.maya.enabled || sf.bank.enabled || Boolean(sf.qrUrl);
}
