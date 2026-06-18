/**
 * Money helpers — PHP, stored as integer **centavos**. Never use floats for
 * money. 1 peso = 100 centavos.
 *
 * All persisted money columns are `*_centavos int`. Convert to a display string
 * only at the UI boundary with {@link formatCentavos}.
 */

const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

/** Format integer centavos as a PHP currency string, e.g. 12345 -> "₱123.45". */
export function formatCentavos(centavos: number): string {
  if (!Number.isFinite(centavos)) {
    throw new Error(`formatCentavos: expected a finite number, got ${centavos}`);
  }
  return phpFormatter.format(centavos / 100);
}

/**
 * Parse a user-entered peso string/number into integer centavos.
 * Accepts "123.45", "₱1,234.5", 99.9 → 12345, 123450, 9990.
 * Rounds to the nearest centavo to avoid float drift.
 */
export function pesosToCentavos(input: string | number): number {
  const raw =
    typeof input === "number"
      ? input
      : Number(input.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(raw)) {
    throw new Error(`pesosToCentavos: cannot parse "${input}"`);
  }
  return Math.round(raw * 100);
}

/** Convert integer centavos to a plain peso number (for charts/inputs only). */
export function centavosToPesos(centavos: number): number {
  return centavos / 100;
}

/** Multiply a unit price (centavos) by a quantity, returning integer centavos. */
export function lineTotal(unitPriceCentavos: number, quantity: number): number {
  return Math.round(unitPriceCentavos * quantity);
}

/** Sum a list of integer-centavo amounts safely. */
export function sumCentavos(amounts: number[]): number {
  return amounts.reduce((acc, n) => acc + n, 0);
}
