/**
 * Master DB refresh: catalog sync + art embedding backfill + optional price hydrate.
 *
 * Usage:
 *   node scripts/run-master-db-enrich.mjs
 *   node scripts/run-master-db-enrich.mjs --skip-catalog-sync
 *   node scripts/run-master-db-enrich.mjs --skip-art-embeddings
 *   node scripts/run-master-db-enrich.mjs --skip-prices
 *
 * Logs: logs/master-db-enrich-*.log
 */
import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const skipCatalog = process.argv.includes("--skip-catalog-sync");
const skipArt = process.argv.includes("--skip-art-embeddings");
const skipPrices = process.argv.includes("--skip-prices");

const logsDir = join(process.cwd(), "logs");
mkdirSync(logsDir, { recursive: true });

function runStep(name, args) {
  return new Promise((resolve, reject) => {
    const logPath = join(logsDir, `${name}.log`);
    const log = createWriteStream(logPath, { flags: "a" });
    console.log(`\n>> ${name} (log: ${logPath})`);
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.on("close", (code) => {
      log.end();
      if (code === 0) {
        console.log(`   ${name} finished OK`);
        resolve();
      } else {
        reject(new Error(`${name} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log("Master DB enrich pipeline");
  console.log(`  catalog sync: ${skipCatalog ? "SKIP" : "RUN"}`);
  console.log(`  art embeddings: ${skipArt ? "SKIP" : "RUN"}`);
  console.log(`  pokemon prices: ${skipPrices ? "SKIP" : "RUN"}`);

  if (!skipCatalog) {
    await runStep("catalog-sync-all", ["scripts/catalog-sync.mjs", "--franchise=all"]);
  }

  if (!skipArt) {
    await runStep("art-embeddings-all", [
      "scripts/backfill-catalog-art-embeddings.mjs",
      "--franchise=all",
      "--all",
      "--limit=300",
    ]);
  }

  if (!skipPrices) {
    await runStep("pokemon-prices-resume", [
      "scripts/backfill-pokemon-catalog-prices.mjs",
      "--resume",
    ]);
  }

  console.log("\nMaster DB enrich complete.");
}

main().catch((err) => {
  console.error("\nPipeline failed:", err.message);
  process.exit(1);
});
