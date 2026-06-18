// ============================================================================
// Run a .sql file (or inline --sql) against the project's database over the
// Supabase Management API (HTTPS). Used when direct Postgres ports (5432/6543)
// are not reachable from the execution environment.
//
//   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... \
//     node scripts/db-exec.mjs <path-to.sql>
//   ... node scripts/db-exec.mjs --sql "select 1"
//
// Prefer `psql "$SUPABASE_DB_URL" -f file.sql` when DB ports are open; this is
// the HTTPS fallback.
// ============================================================================
import { readFileSync } from "node:fs";

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!token || !ref) {
  console.error("Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF.");
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/db-exec.mjs <file.sql> | --sql <query>");
  process.exit(1);
}
const query =
  arg === "--sql" ? process.argv.slice(3).join(" ") : readFileSync(arg, "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);

const text = await res.text();
if (!res.ok) {
  console.error(`SQL failed (${res.status}): ${text}`);
  process.exit(1);
}
// Print rows compactly (most DDL returns []).
try {
  const rows = JSON.parse(text);
  if (Array.isArray(rows) && rows.length) console.log(JSON.stringify(rows, null, 2));
  else console.log("OK");
} catch {
  console.log("OK");
}
