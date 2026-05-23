/**
 * Smoke test master catalog APIs (local dev server or BASE_URL).
 * Usage: npm run smoke:catalog
 *        BASE_URL=https://pgt-collectibles.vercel.app npm run smoke:catalog
 */
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const base = (process.env.BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");

async function get(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = await res.json().catch(() => ({}));
  return { url, ok: res.ok, status: res.status, body };
}

function pass(msg) {
  console.log(`  OK  ${msg}`);
}

function fail(msg, detail) {
  console.error(`  FAIL ${msg}`);
  if (detail) console.error(`       ${detail}`);
}

async function main() {
  console.log(`Catalog smoke @ ${base}\n`);

  const franchises = await get("/api/catalog/franchises");
  if (!franchises.ok || !franchises.body.franchises?.length) {
    fail("GET /api/catalog/franchises", franchises.body.error ?? franchises.status);
    process.exit(1);
  }
  pass(`franchises (${franchises.body.franchises.length})`);

  for (const franchise of ["magic", "yugioh", "onepiece", "lorcana"]) {
    const sets = await get(`/api/catalog/sets?franchise=${franchise}&page=1&pageSize=5`);
    if (!sets.ok || !sets.body.data?.length) {
      fail(`${franchise} sets`, sets.body.error ?? `count=${sets.body.totalCount}`);
      continue;
    }
    pass(`${franchise} sets (${sets.body.totalCount} total, sample: ${sets.body.data[0].name})`);

    const setId = sets.body.data[0].id;
    const cards = await get(
      `/api/catalog/cards?franchise=${franchise}&setId=${encodeURIComponent(setId)}&page=1&pageSize=3`,
    );
    if (!cards.ok || !cards.body.data?.length) {
      fail(`${franchise} cards`, cards.body.error ?? "empty");
      continue;
    }
    pass(`${franchise} cards in ${setId} (${cards.body.totalCount} total)`);
  }

  const pokedex = await get("/api/pokedex/sets?era=modern&page=1&pageSize=3");
  if (!pokedex.ok || !pokedex.body.data?.length) {
    fail("pokemon pokedex sets", pokedex.body.error ?? pokedex.status);
  } else {
    pass(`pokemon pokedex (${pokedex.body.data[0].name})`);
  }

  console.log("\nCatalog smoke passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
