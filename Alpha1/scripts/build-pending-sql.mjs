import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(root)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const header = `-- AUTO-GENERATED — all migrations bundle
-- Run once via: npm run db:apply:bundle
-- Regenerate: npm run db:build-pending

`;

const body = files
  .map((name) => {
    const sql = readFileSync(join(root, name), "utf8");
    return `-- ========== ${name} ==========\n${sql}\n`;
  })
  .join("\n");

writeFileSync(join(process.cwd(), "supabase", "apply-pending-migrations.sql"), header + body);
console.log(`Wrote supabase/apply-pending-migrations.sql (${files.length} migrations)`);
