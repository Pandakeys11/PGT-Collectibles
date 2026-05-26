import { buildSetCardsQuery } from "../src/lib/pokedex/rarity-buckets.ts";

const setId = process.argv[2] ?? "me2pt5";
const bucket = process.argv[3] ?? "base";

const q = buildSetCardsQuery(setId, bucket);
const u = new URL("https://api.pokemontcg.io/v2/cards");
u.searchParams.set("q", q);
u.searchParams.set("page", "1");
u.searchParams.set("pageSize", "250");
u.searchParams.set("orderBy", "number");

const t0 = Date.now();
const r = await fetch(u, {
  signal: AbortSignal.timeout(45_000),
  headers: { Accept: "application/json" },
});
console.log("status", r.status, "ms", Date.now() - t0);
const j = await r.json();
console.log("data", j.data?.length, "total", j.totalCount);
