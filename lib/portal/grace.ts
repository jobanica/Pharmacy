/**
 * The grace period between paid covering running out and the account being
 * suspended.
 *
 * Pure and dependency-free (no server-only) because both sides need it: the
 * sweep that does the suspending, and the billing page that warns the owner
 * before it happens. Postgres holds the same number as the default argument
 * of suspend_lapsed_accounts(); the sweep passes this one explicitly so there
 * is a single source of truth.
 */

/**
 * A receipt can sit unreviewed, a bank transfer can land late, a callback can
 * arrive out of order. Seven days is the cushion before any of that costs a
 * pharmacy access to its own POS.
 */
export const GRACE_DAYS = 7;

/** When an account is suspended, given when its paid coverage ended. */
export function suspendsAt(paidUntil: Date): Date {
  return new Date(paidUntil.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
}
