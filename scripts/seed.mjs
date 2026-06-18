// ============================================================================
// Seed two pharmacy organizations to demonstrate features + tenant isolation.
// Run AFTER the reset + migrations:
//   node --env-file=.env.local scripts/seed.mjs
//
// Uses the service-role key (bypasses RLS) and the Auth admin API to create
// users with passwords. The handle_new_user() trigger bootstraps each owner's
// org+branch+membership from sign-up metadata; extra members are attached here.
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run with: node --env-file=.env.local scripts/seed.mjs",
  );
  process.exit(1);
}

const DEV_PASSWORD = "Password123!";
const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const created = [];

async function createUser(email, fullName, metadata = {}) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, ...metadata },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user;
}

async function ownerWithOrg(email, fullName, orgName, branchName) {
  const user = await createUser(email, fullName, {
    org_name: orgName,
    branch_name: branchName,
  });
  // Trigger created org + branch + owner membership; read them back.
  const { data: membership, error } = await supabase
    .from("memberships")
    .select("organization_id, default_branch_id")
    .eq("user_id", user.id)
    .single();
  if (error) throw new Error(`read owner membership: ${error.message}`);
  created.push({ org: orgName, role: "owner", email });
  return {
    userId: user.id,
    orgId: membership.organization_id,
    branchId: membership.default_branch_id,
  };
}

async function addBranch(orgId, name) {
  const { data, error } = await supabase
    .from("branches")
    .insert({ organization_id: orgId, name })
    .select("id")
    .single();
  if (error) throw new Error(`addBranch(${name}): ${error.message}`);
  return data.id;
}

async function addMember(orgId, email, fullName, role, branchId) {
  const user = await createUser(email, fullName);
  const { error } = await supabase.from("memberships").insert({
    organization_id: orgId,
    user_id: user.id,
    role,
    default_branch_id: branchId,
    status: "active",
  });
  if (error) throw new Error(`addMember(${email}): ${error.message}`);
  created.push({ org: orgId, role, email });
  return user.id;
}

async function addPendingInvite(orgId, invitedBy, email, role) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const expiresAt = new Date(Date.now() + 7 * 864e5).toISOString();
  const { error } = await supabase.from("invitations").insert({
    organization_id: orgId,
    email,
    role,
    token,
    expires_at: expiresAt,
    invited_by: invitedBy,
  });
  if (error) throw new Error(`addPendingInvite(${email}): ${error.message}`);
}

async function main() {
  console.log("Seeding organizations...\n");

  // --- Organization A: MercuryRx (fully staffed, 2 branches) ----------------
  const a = await ownerWithOrg(
    "owner@mercuryrx.ph",
    "Maria Owner",
    "MercuryRx Pharmacy",
    "Main Branch",
  );
  const annexId = await addBranch(a.orgId, "Annex Branch");
  await addMember(a.orgId, "manager@mercuryrx.ph", "Mark Manager", "manager", a.branchId);
  await addMember(a.orgId, "pharmacist@mercuryrx.ph", "Pia Pharmacist", "pharmacist", annexId);
  await addMember(a.orgId, "cashier@mercuryrx.ph", "Cleo Cashier", "cashier", a.branchId);
  await addPendingInvite(a.orgId, a.userId, "newhire@mercuryrx.ph", "cashier");

  // --- Organization B: GeneriCare (separate tenant, for isolation tests) ----
  const b = await ownerWithOrg(
    "owner@genericare.ph",
    "Ben Owner",
    "GeneriCare Pharmacy",
    "Quezon City Branch",
  );
  void b;

  console.log("Done. Test accounts (password for all: %s):\n", DEV_PASSWORD);
  console.table(created.map((c) => ({ email: c.email, role: c.role })));
  console.log(
    "\nOrg A (MercuryRx) has 4 members + 2 branches + 1 pending invite.",
  );
  console.log("Org B (GeneriCare) is a separate tenant for isolation testing.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
