/**
 * Uniform pipeline: priority FMV (chase + top value) → global comps→ticks.
 *
 *   node scripts/run-priority-fmv-pipeline.mjs
 *   node scripts/run-priority-fmv-pipeline.mjs --recent=36
 */
import { spawn } from "node:child_process";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const extra = process.argv.slice(2);
const ROOT = process.cwd();

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${label} ===\n> ${cmd} ${args.join(" ")}\n`);
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true, env: process.env });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${label} exit ${code}`))));
  });
}

const fmvArgs = ["--yes", "tsx", "scripts/backfill-pokemon-priority-fmv.ts", ...extra];
if (!extra.some((a) => a.startsWith("--recent"))) {
  fmvArgs.push(`--recent=${process.env.FMV_PRIORITY_MAX_SETS ?? "24"}`);
}

await run("npx", fmvArgs, "Priority FMV (chase + top value)");
await run(
  "npx",
  ["--yes", "tsx", "scripts/backfill-pgt-us-trends.ts", "--from-comps"],
  "PGT ticks from comps (global)",
);
console.log("\n[priority-fmv-pipeline] complete. Spot-check: node scripts/report-pgt-us-set.mjs --set=<code>");
