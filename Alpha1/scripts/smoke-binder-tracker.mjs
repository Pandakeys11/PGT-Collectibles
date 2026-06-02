/**
 * Verify catalog_binder_owned_cards table + binder-tracker API (local dev server optional).
 *
 *   node scripts/smoke-binder-tracker.mjs
 *   node scripts/smoke-binder-tracker.mjs --db-only
 */
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const dbOnly = process.argv.includes("--db-only");

const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
const connectionString =
  process.env.SUPABASE_DB_URL?.trim() ||
  (password && projectRef
    ? `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`
    : null);

if (!connectionString) {
  console.error("Need SUPABASE_DB_URL or SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  const { rows } = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalog_binder_owned_cards'
    order by ordinal_position
  `);

  if (rows.length === 0) {
    console.error("FAIL: public.catalog_binder_owned_cards does not exist.");
    console.error("Fix: npm run db:apply:binder-tracker");
    process.exit(1);
  }

  console.log("OK: catalog_binder_owned_cards columns:");
  for (const row of rows) {
    console.log(`  - ${row.column_name}: ${row.data_type}`);
  }

  const { rows: idx } = await client.query(`
    select indexname from pg_indexes
    where schemaname = 'public' and tablename = 'catalog_binder_owned_cards'
  `);
  console.log(`OK: ${idx.length} index(es)`);

  await client.query(`notify pgrst, 'reload schema'`);
  console.log("OK: PostgREST schema cache reload notified");
} finally {
  await client.end();
}

if (dbOnly) {
  console.log("DB check passed (--db-only).");
  process.exit(0);
}

const base = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3002";
const setId = process.env.SMOKE_BINDER_SET_ID?.trim() || "base1";
const url = `${base}/api/catalog/binder-tracker?setId=${encodeURIComponent(setId)}`;

try {
  const res = await fetch(url, { credentials: "include" });
  const body = await res.json();
  if (res.status === 503 && body.code === "TABLE_NOT_READY") {
    console.error("FAIL: API reports table not ready:", body.error);
    console.error(body.setupHint ?? "Run npm run db:apply:binder-tracker");
    process.exit(1);
  }
  if (res.status >= 500 && body.error?.includes("schema cache")) {
    console.error("FAIL:", body.error);
    process.exit(1);
  }
  console.log(`OK: GET ${url} -> ${res.status}`, body.signedIn === false ? "(unsigned)" : "");
} catch (e) {
  console.warn("Skip API check (dev server may be down):", e.message);
  console.log("DB check passed.");
}
