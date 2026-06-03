/**
 * Steps 2–4 after FMV: comps→ticks, report, momentum audit.
 * node scripts/run-me2-post-fmv.mjs
 */
import { spawn } from "node:child_process";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const SET = "me2";
const ROOT = process.cwd();

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${label} ===\n> ${cmd} ${args.join(" ")}\n`);
    const child = spawn(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true, env: process.env });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${label} exit ${code}`))));
  });
}

await run(
  "npx",
  ["--yes", "tsx", "scripts/backfill-pgt-us-trends.ts", "--from-comps", `--set=${SET}`],
  "PGT ticks from comps",
);
await run("node", ["scripts/report-pgt-us-set.mjs", `--set=${SET}`], "Coverage");
await run("npx", ["--yes", "tsx", "scripts/debug-set-momentum.ts", SET], "Movers audit");
console.log("\n[me2-post-fmv] done.");
