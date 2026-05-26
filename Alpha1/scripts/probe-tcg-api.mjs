import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const key = process.env.POKEMON_TCG_API_KEY?.trim();
const headers = { Accept: "application/json" };
if (key) headers["X-Api-Key"] = key;

async function probe(label, url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const text = await res.text();
    let totalCount = null;
    let dataLen = null;
    try {
      const j = JSON.parse(text);
      totalCount = j.totalCount;
      dataLen = j.data?.length;
    } catch {
      /* ignore */
    }
    console.log(label, res.status, { totalCount, dataLen, bytes: text.length });
  } catch (e) {
    console.log(label, "ERR", e?.name ?? e);
  } finally {
    clearTimeout(t);
  }
}

const base = "https://api.pokemontcg.io/v2";
await probe("sets p1", `${base}/sets?page=1&pageSize=250&orderBy=-releaseDate`);
await probe("sets p2", `${base}/sets?page=2&pageSize=250&orderBy=-releaseDate`);
await probe("cards sv1", `${base}/cards?q=set.id:sv1&page=1&pageSize=10&orderBy=number`);
