/**
 * Apply pending Supabase migrations.
 *
 * Set ONE of these in .env.local:
 *   SUPABASE_DB_PASSWORD=...     (Database password from Supabase dashboard)
 *   SUPABASE_ACCESS_TOKEN=sbp_... (Account → Access Tokens, database:write scope)
 *
 * Usage: npm run db:apply
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

const REGIONS = ["us-east-1", "us-east-2", "us-west-1", "eu-west-1", "eu-central-1", "ap-southeast-1"];

function buildDbUrls(password) {
  const enc = encodeURIComponent(password);
  const urls = [`postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`];
  for (const region of REGIONS) {
    urls.push(
      `postgresql://postgres.${projectRef}:${enc}@aws-1-${region}.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${projectRef}:${enc}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
      `postgresql://postgres.${projectRef}:${enc}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    );
  }
  return urls;
}

async function applyViaManagementApi(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token || !projectRef) return false;

  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${text.slice(0, 400)}`);
  }
  return true;
}

async function applyViaPg(sql) {
  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (process.env.SUPABASE_DB_URL?.trim()) {
    const client = new pg.Client({
      connectionString: process.env.SUPABASE_DB_URL.trim(),
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
    return true;
  }

  if (!password || !projectRef) return false;

  let lastConnectErr;
  for (const connectionString of buildDbUrls(password)) {
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    const host = connectionString.includes("db.")
      ? "direct"
      : connectionString.match(/aws-[01]-([^/]+)/)?.[1] ?? "pooler";
    try {
      await client.connect();
    } catch (err) {
      lastConnectErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
      continue;
    }
    try {
      await client.query(sql);
      await client.end();
      console.log(`Connected (${host})`);
      return true;
    } catch (err) {
      await client.end().catch(() => {});
      // Connected but SQL failed — do not fall through to other hosts
      throw err;
    }
  }
  throw lastConnectErr ?? new Error("No database connection succeeded");
}

async function main() {
  const sqlPath = join(process.cwd(), "supabase", "apply-pending-migrations.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log(`Project: ${projectRef ?? "unknown"}\n`);

  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) {
    console.log("Applying via Supabase Management API...");
    await applyViaManagementApi(sql);
    return;
  }

  if (process.env.SUPABASE_DB_PASSWORD?.trim() || process.env.SUPABASE_DB_URL?.trim()) {
    console.log("Applying via Postgres...");
    await applyViaPg(sql);
    return;
  }

  console.error(`
Cannot apply migrations — no database credentials in .env.local.

Add ONE of:

  SUPABASE_DB_PASSWORD=your-database-password
  (Supabase → Project Settings → Database → Database password)

  SUPABASE_ACCESS_TOKEN=sbp_...
  (https://supabase.com/dashboard/account/tokens — database:write scope)

Then run: npm run db:apply
`);
  process.exit(1);
}

main()
  .then(() => {
    console.log("\nDone. Run: npm run db:verify\n");
  })
  .catch((err) => {
    console.error("\nMigration failed:", err.message);
    process.exit(1);
  });
