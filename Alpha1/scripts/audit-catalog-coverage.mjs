import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "reports");
const CACHE_DIR = path.join(OUT_DIR, ".cache");
const BASE = "https://api.pokemontcg.io/v2";

const promoSpecialPath = path.join(ROOT, "src", "data", "pokedex", "catalog-promo-special-sets.json");
const setOverlaysPath = path.join(ROOT, "src", "data", "pokedex", "catalog-set-overlays.json");
const variantArtworkPath = path.join(ROOT, "src", "data", "pokedex", "catalog-variant-artwork.json");

function headers() {
  const key = process.env.POKEMON_TCG_API_KEY?.trim();
  return key ? { Accept: "application/json", "X-Api-Key": key } : { Accept: "application/json" };
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`);
  return res.json();
}

async function fetchAllSets() {
  const cached = await readCache("sets.json");
  if (cached) return cached;
  const url = new URL(`${BASE}/sets`);
  url.searchParams.set("pageSize", "250");
  url.searchParams.set("orderBy", "releaseDate");
  const payload = await fetchJson(url);
  const sets = payload.data ?? [];
  await writeCache("sets.json", sets);
  return sets;
}

async function fetchCardsForSet(setId) {
  const cacheName = `cards-${setId}.json`;
  const cached = await readCache(cacheName);
  if (cached) return cached;
  const cards = [];
  let page = 1;
  const pageSize = 250;
  for (;;) {
    const url = new URL(`${BASE}/cards`);
    url.searchParams.set("q", `set.id:${setId}`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("select", "id,name,number,rarity,set,subtypes,supertype,images");
    url.searchParams.set("orderBy", "number");
    const payload = await fetchJson(url);
    cards.push(...(payload.data ?? []));
    if (!payload.data?.length || cards.length >= payload.totalCount) break;
    page += 1;
  }
  await writeCache(cacheName, cards);
  return cards;
}

async function fetchAllCards(sets) {
  const out = [];
  let done = 0;
  for (const set of sets) {
    const cards = await fetchCardsForSet(set.id);
    out.push(...cards);
    done += 1;
    if (done % 20 === 0 || done === sets.length) {
      console.error(`Fetched cards for ${done}/${sets.length} sets (${out.length} cards)`);
    }
  }
  return out;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function readCache(name) {
  try {
    return JSON.parse(await fs.readFile(path.join(CACHE_DIR, name), "utf8"));
  } catch {
    return null;
  }
}

async function writeCache(name, data) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(path.join(CACHE_DIR, name), `${JSON.stringify(data)}\n`);
}

function yearOf(set) {
  return String(set.releaseDate ?? "").slice(0, 4) || "unknown";
}

function looksPromoSet(set) {
  const blob = `${set.id} ${set.name} ${set.series}`.toLowerCase();
  return /\bpromo|promos|black star|pop series|mcdonald|futsal|trainer kit|world championship|best of game|battle academy/.test(blob);
}

function looksSpecialSet(set) {
  const blob = `${set.id} ${set.name}`.toLowerCase();
  return /southern islands|legendary collection|call of legends|dragon vault|double crisis|generations|shining legends|dragon majesty|detective pikachu|hidden fates|shiny vault|celebrations|classic collection|champion'?s path|shining fates|pokemon go|crown zenith|galarian gallery|151|paldean fates|shrouded fable|prismatic evolutions|trainer gallery|radiant collection/.test(blob);
}

function likelyNeedsPrintingOverlay(set) {
  const id = set.id;
  const releaseYear = Number(yearOf(set));
  if (/^(base|gym|neo|ecard)/.test(id)) return true;
  return Number.isFinite(releaseYear) && releaseYear <= 2003;
}

function likelyNeedsFinishOverlay(set, cards) {
  const setCards = cards.filter((card) => card.set?.id === set.id);
  const rare = setCards.some((card) => card.rarity === "Rare");
  const rareHolo = setCards.some((card) => card.rarity === "Rare Holo");
  const reverse = setCards.some((card) => /reverse holo/i.test(`${card.rarity ?? ""} ${card.name ?? ""}`));
  return reverse || (rare && rareHolo && /legendary collection/i.test(set.name));
}

function subsetSignals(set, cards) {
  const setCards = cards.filter((card) => card.set?.id === set.id);
  const numbers = setCards.map((card) => String(card.number ?? ""));
  const names = setCards.map((card) => String(card.name ?? ""));
  const signals = [];
  if (numbers.some((n) => /^TG\d+/i.test(n))) signals.push("trainer_gallery");
  if (numbers.some((n) => /^GG\d+/i.test(n))) signals.push("galarian_gallery");
  if (numbers.some((n) => /^RC\d+/i.test(n))) signals.push("radiant_collection");
  if (numbers.some((n) => /^SV\d+/i.test(n))) signals.push("shiny_vault_like");
  if (names.some((n) => /classic collection/i.test(n)) || /classic collection/i.test(set.name)) signals.push("classic_collection");
  return signals;
}

function toRow(set) {
  return {
    setId: set.id,
    name: set.name,
    series: set.series,
    releaseDate: set.releaseDate,
    printedTotal: set.printedTotal,
    total: set.total,
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const [promoSpecial, overlaysRoot, variantRoot, sets] = await Promise.all([
    readJson(promoSpecialPath),
    readJson(setOverlaysPath),
    readJson(variantArtworkPath),
    fetchAllSets(),
  ]);
  const cards = await fetchAllCards(sets);

  const promoSpecialIds = new Set(promoSpecial.map((row) => row.setId));
  const overlayIds = new Set((overlaysRoot.sets ?? []).map((row) => row.setId));
  const variantIds = new Set(Object.keys(variantRoot.sets ?? {}));

  const promoLike = sets.filter(looksPromoSet);
  const specialLike = sets.filter(looksSpecialSet);
  const promoSpecialCandidateIds = new Set([...promoLike, ...specialLike].map((set) => set.id));
  const missingPromoSpecial = sets
    .filter((set) => promoSpecialCandidateIds.has(set.id) && !promoSpecialIds.has(set.id))
    .map(toRow);

  const stalePromoSpecial = [...promoSpecialIds]
    .filter((setId) => !sets.some((set) => set.id === setId))
    .sort();

  const missingPrintingOverlays = sets
    .filter((set) => likelyNeedsPrintingOverlay(set) && !overlayIds.has(set.id))
    .map(toRow);

  const finishOverlayCandidates = sets
    .filter((set) => likelyNeedsFinishOverlay(set, cards))
    .filter((set) => {
      const overlay = (overlaysRoot.sets ?? []).find((row) => row.setId === set.id);
      return !overlay?.finishVariants?.length;
    })
    .map((set) => ({ ...toRow(set), signals: subsetSignals(set, cards) }));

  const subsetSets = sets
    .map((set) => ({ ...toRow(set), signals: subsetSignals(set, cards) }))
    .filter((row) => row.signals.length > 0);

  const noImages = cards
    .filter((card) => !card.images?.small && !card.images?.large)
    .map((card) => ({
      id: card.id,
      name: card.name,
      number: card.number,
      setId: card.set?.id,
      setName: card.set?.name,
    }));

  const cardsBySet = new Map();
  for (const card of cards) {
    const setId = card.set?.id ?? "unknown";
    cardsBySet.set(setId, (cardsBySet.get(setId) ?? 0) + 1);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    source: "https://api.pokemontcg.io/v2",
    setCount: sets.length,
    cardCount: cards.length,
    curatedPromoSpecialCount: promoSpecialIds.size,
    curatedSetOverlayCount: overlayIds.size,
    variantArtworkSetCount: variantIds.size,
    promoLikeCount: promoLike.length,
    specialLikeCount: specialLike.length,
    missingPromoSpecialCount: missingPromoSpecial.length,
    stalePromoSpecialCount: stalePromoSpecial.length,
    missingPrintingOverlayCount: missingPrintingOverlays.length,
    finishOverlayCandidateCount: finishOverlayCandidates.length,
    subsetSetCount: subsetSets.length,
    cardsMissingImagesCount: noImages.length,
  };

  const report = {
    summary,
    missingPromoSpecial,
    stalePromoSpecial,
    missingPrintingOverlays,
    finishOverlayCandidates,
    subsetSets,
    cardsMissingImages: noImages.slice(0, 250),
    allSets: sets.map((set) => ({ ...toRow(set), cardCount: cardsBySet.get(set.id) ?? 0 })),
  };

  const jsonPath = path.join(OUT_DIR, "catalog-coverage-audit.json");
  const mdPath = path.join(OUT_DIR, "catalog-coverage-audit.md");
  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(mdPath, markdown(report));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${path.relative(ROOT, jsonPath)} and ${path.relative(ROOT, mdPath)}`);
}

function table(rows, columns, limit = 50) {
  if (!rows.length) return "_None._\n";
  const shown = rows.slice(0, limit);
  const header = `| ${columns.join(" | ")} |`;
  const sep = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = shown
    .map((row) => `| ${columns.map((c) => String(row[c] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`)
    .join("\n");
  const more = rows.length > limit ? `\n\n_Showing ${limit} of ${rows.length}._` : "";
  return `${header}\n${sep}\n${body}${more}\n`;
}

function markdown(report) {
  const { summary } = report;
  return `# Catalog Coverage Audit

Generated: ${summary.generatedAt}

## Summary

- Source: ${summary.source}
- API sets: ${summary.setCount}
- API cards: ${summary.cardCount}
- Curated promo/special rows: ${summary.curatedPromoSpecialCount}
- Curated set overlays: ${summary.curatedSetOverlayCount}
- Variant artwork sets: ${summary.variantArtworkSetCount}
- Promo-like API sets: ${summary.promoLikeCount}
- Special-like API sets: ${summary.specialLikeCount}
- Missing promo/special candidates: ${summary.missingPromoSpecialCount}
- Stale promo/special rows: ${summary.stalePromoSpecialCount}
- Missing likely printing overlays: ${summary.missingPrintingOverlayCount}
- Finish overlay candidates: ${summary.finishOverlayCandidateCount}
- Subset signal sets: ${summary.subsetSetCount}
- Cards missing API images: ${summary.cardsMissingImagesCount}

## Missing Promo/Special Candidates

${table(report.missingPromoSpecial, ["setId", "name", "series", "releaseDate", "printedTotal", "total"])}

## Stale Promo/Special Rows

${report.stalePromoSpecial.length ? report.stalePromoSpecial.map((x) => `- ${x}`).join("\n") : "_None._"}

## Missing Likely Printing Overlays

${table(report.missingPrintingOverlays, ["setId", "name", "series", "releaseDate", "printedTotal", "total"])}

## Finish Overlay Candidates

${table(report.finishOverlayCandidates, ["setId", "name", "series", "releaseDate", "signals"])}

## Subset Signal Sets

${table(report.subsetSets, ["setId", "name", "series", "releaseDate", "signals"], 80)}

## Notes

- This audit checks the English/API catalog spine from PokemonTCG.io. It does not prove Japanese, jumbo, error, staff stamp, prerelease stamp, World Championship deck reprints, or sealed SKU completeness unless those are represented in the API or curated overlays.
- PokemonTCG.io often merges real-world printings into one card row. Overlay coverage is still required for 1st Edition, Unlimited, Shadowless, reverse holo variants, deck exclusives, and sealed-product intent.
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
