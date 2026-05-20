/**
 * Functional check: trial plan = 15 credits/month, no daily cap.
 * Usage: node scripts/verify-free-tier-limits.mjs
 */
import pg from "pg";
import { randomUUID } from "node:crypto";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_DB_PASSWORD?.trim();

if (!projectRef || !password) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const connectionString =
  process.env.SUPABASE_DB_URL?.trim() ||
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

async function main() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const testId = randomUUID();
  const clerkId = `verify-free-tier-${Date.now()}`;

  try {
    await client.query(
      `insert into public.app_users (id, clerk_user_id, plan)
       values ($1, $2, 'trial'::public.user_plan)`,
      [testId, clerkId],
    );

    const { rows } = await client.query(
      `select allowed, reason, daily_limit, monthly_limit, monthly_used
       from public.consume_scan_credits($1, 1, $2, '{}'::jsonb)`,
      [testId, "/verify-free-tier"],
    );
    const first = rows[0];

    if (first.allowed !== true || first.daily_limit !== null || first.monthly_limit !== 15) {
      throw new Error(
        `Unexpected first scan: ${JSON.stringify(first)} (expected allowed=true, daily_limit=null, monthly_limit=15)`,
      );
    }

    for (let i = 0; i < 14; i++) {
      const { rows: okRows } = await client.query(
        `select allowed, reason from public.consume_scan_credits($1, 1, $2, '{}'::jsonb)`,
        [testId, "/verify-free-tier"],
      );
      if (okRows[0]?.allowed !== true) {
        throw new Error(`Scan ${i + 2} blocked early: ${JSON.stringify(okRows[0])}`);
      }
    }

    const { rows: blockedRows } = await client.query(
      `select allowed, reason, monthly_used, monthly_limit
       from public.consume_scan_credits($1, 1, $2, '{}'::jsonb)`,
      [testId, "/verify-free-tier"],
    );
    const blocked = blockedRows[0];

    if (
      blocked.allowed !== false ||
      blocked.reason !== "monthly_limit" ||
      blocked.monthly_used !== 15 ||
      blocked.monthly_limit !== 15
    ) {
      throw new Error(`16th scan should hit monthly_limit: ${JSON.stringify(blocked)}`);
    }

    console.log("OK free tier limits: 15/month, no daily cap, blocks on scan #16");
  } finally {
    await client.query("delete from public.app_users where id = $1", [testId]);
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAIL free tier limits:", err.message);
  process.exit(1);
});
