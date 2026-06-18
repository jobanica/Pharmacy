// ============================================================================
// Prove tenant isolation with the ANON key (RLS enforced, just like the app).
// Run after seeding:
//   node --env-file=.env.local scripts/verify-isolation.mjs
//
// Signs in as each org's owner and asserts they can see ONLY their own org's
// rows. Exits non-zero if any cross-tenant leak is detected.
// ============================================================================
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const PASSWORD = "Password123!";
let failures = 0;

function check(label, condition) {
  console.log(`${condition ? "✓ PASS" : "✗ FAIL"}  ${label}`);
  if (!condition) failures++;
}

async function clientFor(email) {
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return supabase;
}

async function main() {
  const a = await clientFor("owner@mercuryrx.ph");
  const b = await clientFor("owner@genericare.ph");

  const { data: aOrgs } = await a.from("organizations").select("id, name");
  const { data: bOrgs } = await b.from("organizations").select("id, name");

  check("Org A owner sees exactly 1 organization", aOrgs?.length === 1);
  check("Org A owner sees MercuryRx", aOrgs?.[0]?.name === "MercuryRx Pharmacy");
  check("Org B owner sees exactly 1 organization", bOrgs?.length === 1);
  check("Org B owner sees GeneriCare", bOrgs?.[0]?.name === "GeneriCare Pharmacy");

  const bOrgId = bOrgs?.[0]?.id;

  // Org A explicitly targets Org B's id — RLS must return nothing.
  const { data: leak } = await a
    .from("organizations")
    .select("id")
    .eq("id", bOrgId);
  check("Org A cannot read Org B by id (no leak)", (leak?.length ?? 0) === 0);

  // Branches must not cross tenants.
  const { data: aBranches } = await a.from("branches").select("organization_id");
  check(
    "Org A sees only its own branches",
    (aBranches?.length ?? 0) > 0 &&
      aBranches.every((br) => br.organization_id === aOrgs?.[0]?.id),
  );

  // Memberships must not cross tenants.
  const { data: aMembers } = await a.from("memberships").select("organization_id");
  check(
    "Org A sees only its own memberships",
    (aMembers?.length ?? 0) === 4 &&
      aMembers.every((m) => m.organization_id === aOrgs?.[0]?.id),
  );

  console.log(
    failures === 0
      ? "\nAll isolation checks passed."
      : `\n${failures} isolation check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Isolation test error:", err.message);
  process.exit(1);
});
