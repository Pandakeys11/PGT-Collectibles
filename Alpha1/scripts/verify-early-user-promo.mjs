/**
 * Functional check: early-user promo grants 50 bonus scans for signup slots 1–200 only.
 * Usage: node scripts/verify-early-user-promo.mjs
 */
import pg from "pg";
import { loadEnvLocal } from "./load-env-local.mjs";

const EARLY_PROMO_LIMIT = 200;
const EARLY_PROMO_BONUS = 50;

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

  try {
    const { rows: stats } = await client.query(
      `select
         coalesce(max(early_promo_number), 0)::int as claimed,
         count(*) filter (where early_promo_number is not null)::int as promo_users
       from public.app_users`,
    );
    const claimed = stats[0]?.claimed ?? 0;
    if (claimed > EARLY_PROMO_LIMIT) {
      throw new Error(`Too many early promo slots claimed: ${claimed}`);
    }

    if (claimed >= EARLY_PROMO_LIMIT) {
      console.log(`OK early promo full (${claimed}/${EARLY_PROMO_LIMIT} claimed) — skipping signup simulation`);
      return;
    }

    const clerkId = `verify-early-promo-${Date.now()}`;

    try {
      const { rows } = await client.query(
        `select * from public.sync_clerk_user($1, $2, $3, $4)`,
        [clerkId, "verify-early-promo@test.local", "Promo Verify", null],
      );
      const user = rows[0];

      if (user.early_promo_number == null || user.bonus_scans < EARLY_PROMO_BONUS) {
        throw new Error(
          `Expected promo grant for new signup while slots remain: ${JSON.stringify({
            early_promo_number: user.early_promo_number,
            bonus_scans: user.bonus_scans,
          })}`,
        );
      }

      const { rows: ledger } = await client.query(
        `select route, metadata_json from public.usage_ledger
         where user_id = $1 and route = 'early_user_promo'
         order by created_at desc limit 1`,
        [user.id],
      );
      if (!ledger[0]?.route) {
        throw new Error(`Missing early_user_promo ledger row for new signup (run 202605200004 migration)`);
      }

      console.log(
        `OK early promo auto-grant: slot #${user.early_promo_number}, +${user.bonus_scans} bonus scans`,
      );
    } finally {
      await client.query("delete from public.app_users where clerk_user_id = $1", [clerkId]);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("FAIL early user promo:", err.message);
  process.exit(1);
});
