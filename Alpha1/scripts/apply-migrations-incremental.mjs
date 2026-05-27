/**
 * Apply Supabase SQL migrations one file at a time (idempotent, tracked).
 *
 * Tracks applied files in public.schema_migrations so re-runs are safe.
 *
 * Usage:
 *   npm run db:apply              # apply pending migrations
 *   npm run db:apply -- --stamp-all   # mark every file applied without running SQL (existing DB)
 *
 * Requires SUPABASE_DB_PASSWORD or SUPABASE_DB_URL in .env.local
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const stampAll = process.argv.includes("--stamp-all");

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
  console.error("Need SUPABASE_DB_URL or SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL in .env.local");
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const BOOTSTRAP = `
create table if not exists public.schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
`;

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`Project: ${projectRef ?? "linked"}\n`);

  try {
    await client.query(BOOTSTRAP);

    const { rows: appliedRows } = await client.query(
      "select filename from public.schema_migrations order by filename",
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    if (stampAll) {
      for (const name of files) {
        if (applied.has(name)) continue;
        await client.query(
          "insert into public.schema_migrations (filename) values ($1) on conflict do nothing",
          [name],
        );
        console.log(`[stamped] ${name}`);
      }
      console.log("\nStamp complete. New migrations can be applied with: npm run db:apply");
      return;
    }

    let ran = 0;
    for (const name of files) {
      if (applied.has(name)) {
        console.log(`[skip] ${name}`);
        continue;
      }
      const sql = readFileSync(join(migrationsDir, name), "utf8");
      console.log(`[apply] ${name} ...`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (filename) values ($1)",
          [name],
        );
        await client.query("commit");
        console.log(`[ok] ${name}`);
        ran += 1;
      } catch (err) {
        await client.query("rollback");
        throw new Error(`${name}: ${err.message}`);
      }
    }

    if (ran === 0) {
      console.log("\nNo pending migrations.");
    } else {
      console.log(`\nApplied ${ran} migration(s).`);
    }
    console.log("Run: npm run db:verify");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
