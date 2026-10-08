import "server-only";

/**
 * Where subscribers send their activation and monthly payments.
 *
 * Platform-wide, set by a super-admin at /admin/payments, and shown to a
 * referred pharmacy once it has signed the service agreement — otherwise
 * "pay by bank transfer" never says where to.
 *
 * Not to be confused with a pharmacy's own storefront QR, which is how IT
 * takes money from ITS customers. This is money coming in to Reseta. The two
 * share a jsonb shape and a parser, nothing else.
 *
 * Nothing here is secret: it is printed on a page for subscribers to read.
 */
import { createServiceClient } from "@/lib/supabase/service";
import {
  brandingPublicUrl,
  readBankMethod,
  readPayMethod,
  s,
  type BankMethod,
  type PayMethod,
} from "@/lib/storefront/settings";
import type { Json } from "@/lib/supabase/types";

export type CollectionDetails = {
  qrPath: string | null;
  qrUrl: string | null;
  gcash: PayMethod;
  maya: PayMethod;
  bank: BankMethod;
  /** Free text under the QR — "put your pharmacy name in the message", etc. */
  note: string;
};

export function readCollectionDetails(value: Json | null | undefined): CollectionDetails {
  const d = (value ?? {}) as Record<string, unknown>;
  const qrPath = s(d.qr_path) || null;
  return {
    qrPath,
    qrUrl: qrPath ? brandingPublicUrl(qrPath) : null,
    gcash: readPayMethod(d.gcash),
    maya: readPayMethod(d.maya),
    bank: readBankMethod(d.bank),
    note: s(d.note),
  };
}

/** True when there is actually something to show a subscriber. */
export function hasCollectionDetails(d: CollectionDetails): boolean {
  return Boolean(d.qrUrl) || d.gcash.enabled || d.maya.enabled || d.bank.enabled;
}

export async function getCollectionDetails(): Promise<CollectionDetails> {
  try {
    const db = createServiceClient();
    const { data } = await db
      .from("platform_settings")
      .select("payment_details")
      .maybeSingle();
    return readCollectionDetails(data?.payment_details ?? null);
  } catch {
    // Column or row missing — nothing configured yet.
    return readCollectionDetails(null);
  }
}
