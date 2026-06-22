import type { Json } from "@/lib/supabase/types";

/** Default earn rate: ₱20 of net spend = 1 loyalty point. */
export const DEFAULT_PESO_PER_POINT = 20;

export type LoyaltyConfig = {
  /** Pesos of net (post-discount) spend that earn one point. */
  pesoPerPoint: number;
};

/** Parse an organization's jsonb settings into typed loyalty config. */
export function readLoyalty(settings: Json | null | undefined): LoyaltyConfig {
  const root = (settings ?? {}) as { loyalty?: { peso_per_point?: unknown } };
  const raw = Number(root.loyalty?.peso_per_point);
  const pesoPerPoint =
    Number.isFinite(raw) && raw >= 1 ? raw : DEFAULT_PESO_PER_POINT;
  return { pesoPerPoint };
}
