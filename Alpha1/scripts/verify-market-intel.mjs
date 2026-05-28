#!/usr/bin/env node
/**
 * Smoke Phase B market intel tables + read API shape.
 * Usage: node scripts/verify-market-intel.mjs [catalogId]
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const catalogId = (process.argv[2] ?? "neo2-9").trim();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function count(table) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("catalog_id", catalogId);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  console.log(`Phase B intel check for catalog_id=${catalogId}\n`);

  for (const table of [
    "pgt_certifications",
    "pgt_population_snapshots",
    "pgt_market_comps",
  ]) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      console.error(`[FAIL] ${table} — ${error.message}`);
      console.error("Run: npm run db:apply");
      process.exit(1);
    }
    console.log(`[OK] table:${table}`);
  }

  const comps = await count("pgt_market_comps");
  const pop = await count("pgt_population_snapshots");
  const certs = await count("pgt_certifications");

  console.log(`\nRows for ${catalogId}:`);
  console.log(`  pgt_market_comps: ${comps}`);
  console.log(`  pgt_population_snapshots: ${pop}`);
  console.log(`  pgt_certifications: ${certs}`);

  const base = process.env.SMOKE_BASE_URL?.trim() || "http://localhost:3002";
  try {
    const res = await fetch(
      `${base}/api/market/intel?catalogId=${encodeURIComponent(catalogId)}`,
      { cache: "no-store" },
    );
    const json = await res.json();
    console.log(`\n[${res.ok ? "OK" : "WARN"}] GET /api/market/intel → ready=${json.ready} comps=${json.comps?.length ?? 0}`);
  } catch {
    console.log("\n[WARN] Dev server not reachable for /api/market/intel (run npm run dev:clean)");
  }

  console.log("\nDone. Enrich a graded or raw card with a locked catalogId to populate rows.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
