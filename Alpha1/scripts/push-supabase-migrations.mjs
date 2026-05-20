/**
 * Push local migrations to linked Supabase project.
 * Prereq: npx supabase login && npx supabase link --project-ref YOUR_REF
 * Usage: npm run db:push
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const migrationsDir = join(process.cwd(), "supabase", "migrations");
if (!existsSync(migrationsDir)) {
  console.error("supabase/migrations not found");
  process.exit(1);
}

const ordered = [
  "202605180001_auth_profiles_usage.sql",
  "202605180002_companion.sql",
  "202605190001_billing_pro_bonus.sql",
  "202605190002_master_admin_billing.sql",
  "202605200001_pokemon_sprite_assets.sql",
  "202605200002_free_tier_monthly_scans.sql",
  "202605200003_early_user_promo.sql",
  "202605200004_early_user_promo_ledger.sql",
  "202605200005_early_user_promo_ledger_apply.sql",
  "202605200006_early_user_promo_bonus_50.sql",
];

console.log("Migrations to apply (in order):\n");
for (const f of ordered) console.log(`  - ${f}`);

console.log("\nPushing via Supabase CLI...\n");

try {
  execSync("npx supabase@latest db push", {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
  console.log("\nPush complete. Run: npm run db:verify\n");
} catch {
  console.error(`
CLI push failed. Use ONE of these options:

A) Supabase CLI (recommended)
   1. npm install -g supabase   OR use npx supabase
   2. supabase login
   3. supabase link --project-ref YOUR_PROJECT_REF
      (ref = subdomain from NEXT_PUBLIC_SUPABASE_URL)
   4. npm run db:push

B) Supabase Dashboard → SQL Editor
   Run each file in supabase/migrations/ in the order listed above.

Then: npm run db:verify
`);
  process.exit(1);
}
