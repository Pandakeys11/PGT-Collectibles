/**
 * Uniform me2 pipeline: FMV sold comps → PGT ticks → coverage report → momentum audit.
 *
 * Usage: node scripts/run-me2-fmv-pipeline.mjs
 * Env: .env.local (Supabase + eBay/PriceCharting recommended)
 */
import { spawn } from "node:child_process";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const SET = "me2";
const DAYS = 60;
const ROOT = process.cwd();

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${label} ===\n> ${cmd} ${args.join(" ")}\n`);
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited ${code}`));
    });
  });
}

async function main() {
  console.log(`[me2-pipeline] set=${SET} lookback=${DAYS}d`);

  await run(
    "npx",
    ["--yes", "tsx", "scripts/backfill-pokemon-fmv-comps.ts", `--set=${SET}`, `--days=${DAYS}`],
    "FMV sold comps (eBay + PriceCharting)",
  );

  await run(
    "npx",
    ["--yes", "tsx", "scripts/backfill-pgt-us-trends.ts", "--from-comps", `--set=${SET}`],
    "PGT ticks from comps",
  );

  await run("node", ["scripts/report-pgt-us-set.mjs", `--set=${SET}`], "Coverage report");

  await run(
    "npx",
    ["--yes", "tsx", "scripts/debug-set-momentum.ts", SET],
    "Momentum + movers audit",
  );

  console.log("\n[me2-pipeline] complete.");
}

main().catch((e) => {
  console.error("[me2-pipeline] failed:", e.message);
  process.exit(1);
});
