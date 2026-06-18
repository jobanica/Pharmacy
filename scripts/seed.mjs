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

async function seedCatalog(orgId, products, suppliers) {
  // Categories: unique names referenced by products.
  const catNames = [...new Set(products.map((p) => p.cat))];
  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .insert(catNames.map((name) => ({ organization_id: orgId, name })))
    .select("id, name");
  if (catErr) throw new Error(`seed categories: ${catErr.message}`);
  const catId = new Map(cats.map((c) => [c.name, c.id]));

  const { error: prodErr } = await supabase.from("products").insert(
    products.map((p) => ({
      organization_id: orgId,
      category_id: catId.get(p.cat) ?? null,
      name: p.name,
      generic_name: p.generic ?? null,
      sku: p.sku ?? null,
      barcode: p.barcode ?? null,
      unit: p.unit ?? "piece",
      requires_prescription: p.rx ?? false,
      reorder_point: p.reorder ?? 0,
      default_price_centavos: p.price,
      is_active: true,
    })),
  );
  if (prodErr) throw new Error(`seed products: ${prodErr.message}`);

  const { error: supErr } = await supabase
    .from("suppliers")
    .insert(suppliers.map((s) => ({ organization_id: orgId, ...s })));
  if (supErr) throw new Error(`seed suppliers: ${supErr.message}`);

  console.log(
    `  catalog: ${catNames.length} categories, ${products.length} products, ${suppliers.length} suppliers`,
  );
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
  await seedCatalog(
    a.orgId,
    [
      { name: "Biogesic", generic: "Paracetamol 500mg", cat: "Analgesics", unit: "tablet", price: 350, reorder: 50, sku: "BG-500", barcode: "4800001110017" },
      { name: "Alaxan FR", generic: "Ibuprofen + Paracetamol", cat: "Analgesics", unit: "tablet", price: 700, reorder: 40, sku: "AL-FR", barcode: "4800001110024" },
      { name: "Neozep Forte", generic: "Phenylephrine + Chlorphenamine + Paracetamol", cat: "Respiratory", unit: "tablet", price: 680, reorder: 40, sku: "NZ-F" },
      { name: "Bioflu", generic: "Phenylephrine + Chlorphenamine + Paracetamol", cat: "Respiratory", unit: "tablet", price: 850, reorder: 30, sku: "BF-10" },
      { name: "Amoxil", generic: "Amoxicillin 500mg", cat: "Antibiotics", unit: "capsule", price: 1200, reorder: 60, rx: true, sku: "AMX-500" },
      { name: "Cetirizine", generic: "Cetirizine 10mg", cat: "Antihistamines", unit: "tablet", price: 500, reorder: 30, sku: "CTZ-10" },
      { name: "Losartan", generic: "Losartan 50mg", cat: "Cardiovascular", unit: "tablet", price: 900, reorder: 50, rx: true, sku: "LOS-50" },
      { name: "Amlodipine", generic: "Amlodipine 5mg", cat: "Cardiovascular", unit: "tablet", price: 650, reorder: 50, rx: true, sku: "AML-5" },
      { name: "Metformin", generic: "Metformin 500mg", cat: "Antidiabetic", unit: "tablet", price: 480, reorder: 60, rx: true, sku: "MET-500" },
      { name: "Omeprazole", generic: "Omeprazole 20mg", cat: "Gastrointestinal", unit: "capsule", price: 1500, reorder: 30, sku: "OME-20" },
      { name: "Ceelin Syrup", generic: "Ascorbic Acid (Vitamin C)", cat: "Vitamins & Supplements", unit: "bottle", price: 9500, reorder: 20, sku: "CEE-120" },
      { name: "Enervon", generic: "Multivitamins", cat: "Vitamins & Supplements", unit: "tablet", price: 780, reorder: 40, sku: "ENV-1" },
      { name: "Ventolin Nebule", generic: "Salbutamol", cat: "Respiratory", unit: "vial", price: 2500, reorder: 15, rx: true, sku: "VEN-NEB" },
    ],
    [
      { name: "Zuellig Pharma", contact_person: "Rina Santos", phone: "+63 2 8888 1000", email: "orders@zuellig.example" },
      { name: "Metro Drug Inc.", contact_person: "Jun Cruz", phone: "+63 2 8777 2000", email: "sales@metrodrug.example" },
      { name: "MedExpress Distribution", contact_person: "Ana Reyes", phone: "+63 917 555 3000" },
    ],
  );

  // --- Organization B: GeneriCare (separate tenant, for isolation tests) ----
  const b = await ownerWithOrg(
    "owner@genericare.ph",
    "Ben Owner",
    "GeneriCare Pharmacy",
    "Quezon City Branch",
  );
  await seedCatalog(
    b.orgId,
    [
      { name: "Paracetamol", generic: "Paracetamol 500mg", cat: "Analgesics", unit: "tablet", price: 120, reorder: 100, sku: "PCM-500" },
      { name: "Amoxicillin", generic: "Amoxicillin 500mg", cat: "Antibiotics", unit: "capsule", price: 450, reorder: 80, rx: true, sku: "AMOX-500" },
      { name: "Vitamin C", generic: "Ascorbic Acid 500mg", cat: "Vitamins & Supplements", unit: "tablet", price: 90, reorder: 120, sku: "VITC-500" },
    ],
    [{ name: "Generika Distribution", contact_person: "Leo Tan", phone: "+63 2 8123 4567" }],
  );

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
