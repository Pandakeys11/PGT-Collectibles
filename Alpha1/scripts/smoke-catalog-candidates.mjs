/**
 * Smoke test scanner catalog-candidate matching against a running app.
 *
 * Usage:
 *   npm run smoke:catalog-candidates
 *   BASE_URL=http://localhost:3002 npm run smoke:catalog-candidates
 */
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const base = (process.env.BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");
const MAX_MS = Number.parseInt(process.env.CATALOG_CANDIDATE_MAX_MS ?? "8000", 10);

const cases = [
  {
    label: "Legendary Collection Charizard reverse holo",
    expectedCatalogId: "base6-3__reverse_holo",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      set: "Legendary Collection",
      number: "3/110",
      year: "2002",
      rarity: "Reverse Holo",
      printStamps: "Reverse Holo",
      details: "Legendary Collection fireworks reverse holo",
    },
  },
  {
    label: "Base Set Charizard unlimited",
    expectedCatalogId: "base1-4__unlimited",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      year: "1999",
      rarity: "Rare Holo",
      printStamps: "Unlimited",
      details: "Base Set Unlimited holo",
    },
  },
  {
    label: "Base Set Blastoise default",
    expectedCatalogId: "base1-2",
    card: {
      franchise: "pokemon",
      name: "Blastoise",
      set: "Base Set",
      number: "2/102",
      year: "1999",
      rarity: "Rare Holo",
      details: "Base Set holo",
    },
  },
  {
    label: "Base Set Blastoise 1st Edition",
    expectedCatalogId: "base1-2__first_edition",
    card: {
      franchise: "pokemon",
      name: "Blastoise",
      set: "Base Set",
      number: "2/102",
      year: "1999",
      rarity: "Rare Holo",
      printStamps: "1st Edition",
      details: "Base Set 1st Edition holo",
    },
  },
  {
    label: "Base Set Charizard shadowless",
    expectedCatalogId: "base1-4__shadowless",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      set: "Base Set",
      number: "4/102",
      year: "1999",
      rarity: "Rare Holo",
      printStamps: "Shadowless",
      details: "Base Set Shadowless holo",
    },
  },
  {
    label: "Base Set Charizard OCR number repair",
    expectedCatalogId: "base1-4",
    card: {
      franchise: "pokemon",
      name: "Charizard",
      set: "Base Set",
      number: "6/102",
      year: "1999",
      rarity: "Rare Holo",
      details: "Base Set classic Charizard, collector number OCR may be misread",
    },
  },
];

async function postCandidate(card) {
  const start = performance.now();
  const res = await fetch(`${base}/api/scan/catalog-candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ card }),
    signal: AbortSignal.timeout(MAX_MS + 2000),
  });
  const elapsedMs = Math.round(performance.now() - start);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body, elapsedMs };
}

function topCatalogId(body) {
  return body.catalogId ?? body.catalogCandidates?.[0]?.catalogId ?? body.candidates?.[0]?.catalogId ?? null;
}

async function main() {
  console.log(`Catalog candidate smoke @ ${base}\n`);
  let failed = false;

  for (const testCase of cases) {
    const result = await postCandidate(testCase.card);
    const catalogId = topCatalogId(result.body);
    const status = result.body.catalogIdentityStatus ?? "unknown";
    const expectedStatus = testCase.expectedStatus ?? "confirmed";
    const prefix = result.ok &&
      catalogId === testCase.expectedCatalogId &&
      status === expectedStatus &&
      result.elapsedMs <= MAX_MS
      ? "OK "
      : "FAIL";
    console.log(
      `  ${prefix} ${testCase.label}: ${catalogId} / ${status} / ${result.elapsedMs}ms`,
    );
    if (!result.ok) {
      console.error(`       HTTP ${result.status}: ${result.body.error ?? "unknown error"}`);
      failed = true;
    } else if (catalogId !== testCase.expectedCatalogId) {
      console.error(`       expected ${testCase.expectedCatalogId}`);
      failed = true;
    } else if (status !== expectedStatus) {
      console.error(`       expected status ${expectedStatus}`);
      failed = true;
    } else if (result.elapsedMs > MAX_MS) {
      console.error(`       exceeded ${MAX_MS}ms`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log("\nCatalog candidate smoke passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
