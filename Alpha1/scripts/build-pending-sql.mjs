import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "supabase", "migrations");
const files = [
  "202605180002_companion.sql",
  "202605190001_billing_pro_bonus.sql",
  "202605190002_master_admin_billing.sql",
  "202605200001_pokemon_sprite_assets.sql",
  "202605200002_free_tier_monthly_scans.sql",
];

const header = `-- AUTO-GENERATED — pending migrations bundle
-- Run once in Supabase SQL Editor, then: npm run db:verify
-- Regenerate: node scripts/build-pending-sql.mjs

`;

const body = files
  .map((name) => {
    const sql = readFileSync(join(root, name), "utf8");
    return `-- ========== ${name} ==========\n${sql}\n`;
  })
  .join("\n");

writeFileSync(join(process.cwd(), "supabase", "apply-pending-migrations.sql"), header + body);
console.log("Wrote supabase/apply-pending-migrations.sql");
