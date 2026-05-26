import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const setId = process.argv[2] ?? "base1";
const base = "https://api.pokemontcg.io/v2";
const key = process.env.POKEMON_TCG_API_KEY?.trim();
const headers = { Accept: "application/json" };
if (key) headers["X-Api-Key"] = key;

async function probe(label, url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(25_000) });
    const j = await r.json();
    console.log(
      label,
      r.status,
      `${Date.now() - t0}ms`,
      "count=",
      j.data?.length ?? "?",
      "total=",
      j.totalCount ?? "?",
    );
    return r.ok;
  } catch (e) {
    console.log(label, "ERR", Date.now() - t0, e.name, e.message?.slice(0, 80));
    return false;
  }
}

const okSets = await probe(
  "sets",
  `${base}/sets?page=1&pageSize=250&orderBy=-releaseDate`,
);
const okCards = await probe(
  "cards",
  `${base}/cards?q=${encodeURIComponent(`set.id:${setId}`)}&page=1&pageSize=10&orderBy=number`,
);
process.exit(okSets && okCards ? 0 : 1);
