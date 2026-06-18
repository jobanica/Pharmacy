/**
 * Roles & permissions (Section 4 capability matrix).
 *
 * This is the single source of truth for what each role may do. Server Actions
 * call {@link can} at the top of every mutation (added in Milestone 2+), and the
 * app shell uses it to hide UI a role cannot use. UI hiding is convenience only
 * — RLS + server-side guards are the real enforcement.
 */
export const ROLES = ["owner", "manager", "pharmacist", "cashier"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  pharmacist: "Pharmacist",
  cashier: "Cashier",
};

/** Capabilities derived from the Section 4 matrix. */
export type Capability =
  | "manage_org" // org, branches, members, billing
  | "manage_catalog" // products, suppliers, purchase orders
  | "manage_stock" // adjust stock / receive batches
  | "create_sale" // POS
  | "void_sale" // void / refund
  | "view_reports"; // dashboard & reports

const MATRIX: Record<Capability, Role[]> = {
  manage_org: ["owner"],
  manage_catalog: ["owner", "manager", "pharmacist"],
  manage_stock: ["owner", "manager", "pharmacist"],
  create_sale: ["owner", "manager", "pharmacist", "cashier"],
  void_sale: ["owner", "manager"],
  view_reports: ["owner", "manager", "pharmacist"],
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[capability].includes(role);
}

/**
 * Pharmacists see reports for their own branch only; owners/managers see all
 * branches. Used by the dashboard branch filter (Milestone 8).
 */
export function isBranchScopedForReports(role: Role): boolean {
  return role === "pharmacist";
}
