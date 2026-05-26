/**
 * Builds per-card TCGplayer product IDs for vintage print-run artwork.
 * Shadowless Base Set: sequential from 106995 (106996 is a duplicate Alakazam slot).
 *
 * Run: node scripts/build-tcgplayer-vintage-print-map.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src", "data", "pokedex", "tcgplayer-vintage-print-ids.json");
const BASE1_SHADOWLESS_START = 106995;

/** Cards where TCGplayer skips an extra slot before the collector number. */
const BASE1_SHADOWLESS_OVERRIDES = {
  "base1-58": 107055,
};

async function headOk(productId) {
  const res = await fetch(
    `https://product-images.tcgplayer.com/fit-in/437x437/${productId}.jpg`,
    { method: "HEAD" },
  );
  return res.ok;
}

async function main() {
  const base1 = await fetch("https://api.tcgdex.net/v2/en/sets/base1").then((r) => r.json());
  const shadowless = {};
  const shadowlessOverrides = { ...BASE1_SHADOWLESS_OVERRIDES };

  for (const card of base1.cards ?? []) {
    const localId = Number.parseInt(card.localId, 10);
    if (!Number.isFinite(localId)) continue;

    let productId = shadowlessOverrides[card.id];
    if (!productId) {
      productId = localId === 1 ? BASE1_SHADOWLESS_START : BASE1_SHADOWLESS_START + localId;
    }

    if (await headOk(productId)) {
      shadowless[card.id] = productId;
    }
  }

  const payload = {
    version: 2,
    generatedAt: new Date().toISOString(),
    sets: {
      base1: {
        unlimited: { productIdBase: 42378 },
        shadowless,
        shadowlessOverrides,
      },
      base2: { unlimited: { productIdBase: 42443 } },
      base3: { unlimited: { productIdBase: 42508 } },
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT} (${Object.keys(shadowless).length} base1 shadowless ids)`);
  console.log("base1-4 shadowless:", shadowless["base1-4"]);
  console.log("base1-58 shadowless:", shadowless["base1-58"]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
