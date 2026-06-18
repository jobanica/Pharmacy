import "server-only";

/**
 * App context resolution seam.
 *
 * The app shell needs: who the user is, their organization, their role, and the
 * branches they can access (plus the active branch). In Milestone 2 this is
 * resolved from Supabase Auth + the `memberships`/`branches` tables.
 *
 * For Milestone 1 (foundation) there is no auth yet, so this returns a stable
 * DEMO context so the shell renders. The return type is the real contract —
 * only the body changes in M2.
 */
import type { Role } from "@/lib/auth/roles";

export type BranchSummary = {
  id: string;
  name: string;
};

export type AppContext = {
  user: { id: string; fullName: string; email: string };
  organization: { id: string; name: string };
  role: Role;
  branches: BranchSummary[];
  activeBranchId: string;
};

// TODO(Milestone 2): replace with Supabase session + memberships/branches query.
const DEMO_CONTEXT: AppContext = {
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    fullName: "Demo Owner",
    email: "owner@demo.ph",
  },
  organization: {
    id: "00000000-0000-0000-0000-0000000000a1",
    name: "Botika Demo Pharmacy",
  },
  role: "owner",
  branches: [
    { id: "00000000-0000-0000-0000-0000000000b1", name: "Main Branch" },
    { id: "00000000-0000-0000-0000-0000000000b2", name: "Annex Branch" },
  ],
  activeBranchId: "00000000-0000-0000-0000-0000000000b1",
};

export async function getAppContext(): Promise<AppContext> {
  return DEMO_CONTEXT;
}
