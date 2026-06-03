/**
 * Reset starter reroll counts for all hatched companions (3/3 remaining).
 *
 * Usage:
 *   node scripts/reset-companion-starter-rerolls.mjs          # dry run
 *   node scripts/reset-companion-starter-rerolls.mjs --apply  # execute update
 */
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const apply = process.argv.includes("--apply");

const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_DB_PASSWORD?.trim();

if (!projectRef && !process.env.SUPABASE_DB_URL?.trim()) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD (or SUPABASE_DB_URL) in .env.local");
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL?.trim() ||
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const countSql = `
  select
    count(*)::int as total,
    count(*) filter (where hatched_at is not null)::int as hatched,
    count(*) filter (where hatched_at is not null and starter_rerolls_used > 0)::int as needs_reset,
    coalesce(max(starter_rerolls_used), 0)::int as max_used
  from public.user_companions
`;

const resetSql = `
  update public.user_companions
  set starter_rerolls_used = 0,
      updated_at = now()
  where hatched_at is not null
    and starter_rerolls_used <> 0
  returning user_id, starter_rerolls_used
`;

try {
  await client.connect();

  const before = await client.query(countSql);
  const row = before.rows[0];
  console.log("Companion starter reroll status:");
  console.log(`  Total rows:        ${row.total}`);
  console.log(`  Hatched partners:  ${row.hatched}`);
  console.log(`  Need reset (>0):   ${row.needs_reset}`);
  console.log(`  Max used so far:   ${row.max_used}`);

  if (Number(row.needs_reset) === 0) {
    console.log("\nNothing to reset — all hatched companions already at 3/3.");
    process.exit(0);
  }

  if (!apply) {
    console.log(`\nDry run only. Re-run with --apply to reset ${row.needs_reset} account(s) to 3/3 rerolls.`);
    process.exit(0);
  }

  const result = await client.query(resetSql);
  const after = await client.query(countSql);
  console.log(`\nReset ${result.rowCount} account(s) to starter_rerolls_used = 0 (3/3 remaining).`);
  console.log(`  Remaining needing reset: ${after.rows[0].needs_reset}`);
} catch (err) {
  console.error("Reset failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
