/**
 * Verify Showdown animated sprites for COMPANION_ROSTER slugs.
 * Usage: node scripts/verify-companion-sprites.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const rosterSrc = readFileSync(
  path.join(root, "src/lib/companion/pokemon-roster.ts"),
  "utf8",
);

function parseOverrides() {
  const src = readFileSync(path.join(root, "src/lib/companion/showdown-slugs.ts"), "utf8");
  const overrides = {};
  const block = src.match(/SHOWDOWN_SLUG_OVERRIDES[^=]*=\s*\{([^}]*)\}/s);
  if (block?.[1]) {
    for (const m of block[1].matchAll(/["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)) {
      overrides[m[1]] = m[2];
    }
  }
  return overrides;
}

const SHOWDOWN_SLUG_OVERRIDES = parseOverrides();

function resolveShowdownSlug(slug) {
  return SHOWDOWN_SLUG_OVERRIDES[slug] ?? slug;
}

const entries = [];
for (const match of rosterSrc.matchAll(
  /id:\s*(\d+),\s*name:\s*"([^"]+)",\s*slug:\s*"([^"]+)"/g,
)) {
  entries.push({
    id: Number(match[1]),
    name: match[2],
    slug: match[3],
  });
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return res.ok;
  } catch {
    return false;
  }
}

const results = [];
for (const entry of entries) {
  const resolved = resolveShowdownSlug(entry.slug);
  const url = `https://play.pokemonshowdown.com/sprites/ani/${resolved}.gif`;
  const ok = await headOk(url);
  results.push({ ...entry, resolved, ok, url });
}

const missing = results.filter((r) => !r.ok);
const ok = results.filter((r) => r.ok);

console.log(`Companion sprites: ${ok.length}/${results.length} Showdown ani OK\n`);
if (missing.length) {
  console.log("Missing animated (use artwork in battle / upload to storage):");
  for (const row of missing) {
    console.log(`  #${row.id} ${row.name} slug=${row.slug} tried=${row.resolved}`);
  }
} else {
  console.log("All roster entries have Showdown animated sprites.");
}

process.exit(missing.length > 0 ? 1 : 0);
