/**
 * TCGdex EN catalog → JA print bridge (set map + card resolve + image check).
 */

const TCGDEX = "https://api.tcgdex.net/v2";
const TIMEOUT_MS = 10_000;

/** EN pokemontcg.io set id → TCGdex JA set id. */
export const STATIC_EN_TO_JA_SET = {
  base1: "PMCG1",
  base2: "PMCG2",
  base3: "PMCG3",
  base4: "PMCG4",
  gym1: "PMCG5",
  gym2: "PMCG6",
  neo1: "neo1",
  neo2: "neo2",
  neo3: "neo3",
  neo4: "neo4",
  sv3pt5: "SV2a",
  sv3pt5gg: "SV2a",
  sv2: "SV2a",
  sv1: "SV1S",
  swsh12: "S12a",
  swsh12pt5: "S12a",
  swsh11: "S11a",
  swsh10: "S10a",
  swsh9: "S9a",
  swsh8: "S8a",
  sv3: "SV3",
};

export const EN_TO_JA_NAMES = new Map([
  ["Charizard", "リザードン"],
  ["Charizard ex", "リザードンex"],
  ["Charizard V", "リザードンV"],
  ["Charizard VMAX", "リザードンVMAX"],
  ["Blastoise", "カメックス"],
  ["Venusaur", "フシギバナ"],
  ["Pikachu", "ピカチュウ"],
  ["Mewtwo", "ミュウツー"],
  ["Lugia", "ルギア"],
  ["Umbreon", "ブラッキー"],
]);

function padLocalId(value) {
  const raw = String(value ?? "").trim().split("/")[0]?.replace(/^0+/, "") || "";
  return raw ? raw.padStart(3, "0") : null;
}

function normalizeSetKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/pokemon|pokémon|tcg|the|and/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function fetchJson(path, params) {
  const url = new URL(`${TCGDEX}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (!res?.ok) return null;
  return res.json().catch(() => null);
}

export async function fetchAllSets(lang) {
  const out = [];
  for (let page = 1; page <= 60; page += 1) {
    const rows = await fetchJson(`/${lang}/sets`, {
      "pagination:page": String(page),
      "pagination:itemsPerPage": "100",
    });
    if (!rows?.length) break;
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out;
}

export async function fetchSetDetail(lang, setId) {
  return fetchJson(`/${lang}/sets/${encodeURIComponent(setId)}`);
}

export async function fetchCard(lang, cardId) {
  return fetchJson(`/${lang}/cards/${encodeURIComponent(cardId)}`);
}

function officialCount(setRow) {
  return setRow?.cardCount?.official ?? setRow?.cardCount?.total ?? 0;
}

/** Fast EN→JA map: static ids + normalized set title match (no full JA detail prefetch). */
export async function buildEnJaSetMap() {
  const [enSets, jaSets] = await Promise.all([fetchAllSets("en"), fetchAllSets("ja")]);
  const jaByKey = new Map();
  for (const js of jaSets) {
    if (!js.id) continue;
    jaByKey.set(normalizeSetKey(js.name), js.id);
  }

  const map = new Map();
  for (const en of enSets) {
    if (!en.id) continue;
    const staticHit = STATIC_EN_TO_JA_SET[en.id];
    if (staticHit) {
      map.set(en.id, staticHit);
      continue;
    }
    const ek = normalizeSetKey(en.name);
    if (jaByKey.has(ek)) {
      map.set(en.id, jaByKey.get(ek));
      continue;
    }
    for (const [jk, jaId] of jaByKey) {
      if (ek.length >= 4 && (ek.includes(jk) || jk.includes(ek))) {
        map.set(en.id, jaId);
        break;
      }
    }
  }

  return map;
}

const jaDetailCache = new Map();

export async function getJaSetDetail(jaSetId) {
  if (jaDetailCache.has(jaSetId)) return jaDetailCache.get(jaSetId);
  const detail = await fetchSetDetail("ja", jaSetId);
  if (!detail) {
    jaDetailCache.set(jaSetId, null);
    return null;
  }
  const withImage = (detail.cards ?? []).filter((c) => c.image).length;
  const row = {
    id: jaSetId,
    name: detail.name,
    releaseDate: detail.releaseDate ?? null,
    official: officialCount(detail),
    withImage,
    cards: detail.cards ?? [],
  };
  jaDetailCache.set(jaSetId, row);
  return row;
}

function nameCandidates(englishName) {
  const name = String(englishName ?? "").trim();
  if (!name) return [];
  const out = new Set();
  const ja = EN_TO_JA_NAMES.get(name);
  if (ja) out.add(ja);
  for (const [en, jp] of EN_TO_JA_NAMES) {
    if (name.toLowerCase().includes(en.toLowerCase())) out.add(jp);
  }
  if (/charizard/i.test(name)) {
    out.add("リザードン");
    out.add("カリザード");
  }
  return [...out];
}

export function pickJaCardInSet(jaCards, enCard) {
  const num = padLocalId(enCard.card_number ?? enCard.number);
  if (num) {
    const byNum = jaCards.find((c) => padLocalId(c.localId) === num);
    if (byNum) return byNum;
  }
  for (const needle of nameCandidates(enCard.name)) {
    const hit = jaCards.find((c) => (c.name ?? "").includes(needle));
    if (hit) return hit;
  }
  return null;
}

export async function resolveJaPrintForEnCard(enSetId, enCard, setMap) {
  const jaSetId = setMap.get(enSetId) ?? STATIC_EN_TO_JA_SET[enSetId];
  if (!jaSetId) return null;

  const jaSet = await getJaSetDetail(jaSetId);
  if (!jaSet || jaSet.withImage < 8) return null;

  const brief = pickJaCardInSet(jaSet.cards, enCard);
  if (!brief?.id) return null;

  const full = await fetchCard("ja", brief.id);
  const image = full?.image ?? brief.image ?? null;
  if (!image) return null;

  return {
    localizedCatalogId: full?.id ?? brief.id,
    localizedSetCode: jaSetId,
    localizedSetName: jaSet.name,
    localizedName: full?.name ?? brief.name,
    printedNumber: full?.localId ?? brief.localId ?? "",
    imageBaseUrl: image,
  };
}
