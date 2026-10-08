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

/** Public URL for anything in the `branding` bucket (logos, payment QRs). */
export function brandingPublicUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branding/${path}`;
}

export function storefrontQrUrl(path: string): string {
  return brandingPublicUrl(path);
}

export const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
export const b = (v: unknown): boolean => v === true;
const n = (v: unknown): number => (typeof v === "number" && v >= 0 ? Math.round(v) : 0);

/** One jsonb `{enabled,name,number}` block → a typed method. */
export function readPayMethod(v: unknown): PayMethod {
  const m = (v ?? {}) as Record<string, unknown>;
  return { enabled: b(m.enabled), name: s(m.name), number: s(m.number) };
}

/** One jsonb `{enabled,bank_name,name,number}` block → a typed bank method. */
export function readBankMethod(v: unknown): BankMethod {
  const m = (v ?? {}) as Record<string, unknown>;
  return {
    enabled: b(m.enabled),
    bankName: s(m.bank_name),
    name: s(m.name),
    number: s(m.number),
  };
}

/** Parse an organization's jsonb settings into typed storefront config. */
export function readStorefront(settings: Json | null | undefined): Storefront {
  const root = (settings ?? {}) as { storefront?: Record<string, unknown> };
  const sf = root.storefront ?? {};
  const qrPath = s(sf.qr_path) || null;

  return {
    deliveryFeeCentavos: n(sf.delivery_fee_centavos),
    qrPath,
    qrUrl: qrPath ? brandingPublicUrl(qrPath) : null,
    gcash: readPayMethod(sf.gcash),
    maya: readPayMethod(sf.maya),
    bank: readBankMethod(sf.bank),
  };
}

/** True when the customer has at least one online-payment method to pay with. */
export function hasOnlinePayment(sf: Storefront): boolean {
  return sf.gcash.enabled || sf.maya.enabled || sf.bank.enabled || Boolean(sf.qrUrl);
}
