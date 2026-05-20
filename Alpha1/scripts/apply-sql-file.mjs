/**
 * Apply a single SQL file to the linked Supabase Postgres database.
 * Usage: node scripts/apply-sql-file.mjs supabase/migrations/202605200003_early_user_promo.sql
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: node scripts/apply-sql-file.mjs <path-to.sql>");
  process.exit(1);
}

const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_DB_PASSWORD?.trim();

if (!projectRef || (!password && !process.env.SUPABASE_DB_URL?.trim())) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD (or SUPABASE_DB_URL) in .env.local");
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL?.trim() ||
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const sqlPath = resolve(process.cwd(), fileArg);
const sql = readFileSync(sqlPath, "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Applying ${fileArg} ...`);
  await client.query(sql);
  console.log("Done.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
