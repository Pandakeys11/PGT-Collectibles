#!/usr/bin/env node
/**
 * Debug 7d movers for a set (PokeTrace + catalog momentum).
 * Usage: node scripts/debug-set-movers.mjs <setId>
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const setId = process.argv[2]?.trim() || "sv4";

async function main() {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const key = process.env.POKETRACE_API_KEY?.trim();
  console.log("setId:", setId);
  console.log("POKETRACE_API_KEY:", key ? `${key.slice(0, 6)}…` : "(missing)");
  console.log("CATALOG_MOMENTUM_HYDRATE:", process.env.CATALOG_MOMENTUM_HYDRATE ?? "(default on)");

  const q = new URLSearchParams({ setId, refresh: "1" });
  const url = `${base.replace(/\/$/, "")}/api/market/set-movers?${q}`;
  console.log("GET", url);

  const res = await fetch(url);
  const body = await res.json();
  console.log("status:", res.status, "ready:", body.ready, "signal:", body.signalKind);
  console.log("US/EU counts:", body.momentumUsCount, body.momentumEuCount);
  console.log("up:", body.increases?.length ?? 0, "down:", body.decreases?.length ?? 0);
  if (body.error) console.log("error:", body.error);

  const sample = [...(body.increases ?? []), ...(body.decreases ?? [])].slice(0, 6);
  for (const row of sample) {
    console.log(
      `  ${row.momentumPct > 0 ? "+" : ""}${row.momentumPct}%`,
      row.name,
      "|",
      row.momentumLabel,
      "|",
      row.momentumRegion ?? "?",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
