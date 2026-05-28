/**
 * Build uniform Japanese artwork manifest (vintage → modern, TCGdex JA images only).
 *
 * Usage:
 *   npm run catalog:build:pokemon-japanese-artwork
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";
import {
  STATIC_EN_TO_JA_SET,
  buildEnJaSetMap,
  fetchAllSets,
  getJaSetDetail,
  pickJaCardInSet,
  fetchCard,
} from "./lib/tcgdex-ja-bridge.mjs";

loadEnvLocal();

const OUT = path.join(process.cwd(), "src", "data", "pokedex", "japanese-artwork-overlays.json");
const LANGUAGE = "Japanese";
const MIN_CONFIDENCE = 0.92;
const JA_SET_CONCURRENCY = 4;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function bestCatalogUsd(pricesJson) {
  const raw = pricesJson ?? {};
  if (Array.isArray(raw.tcgPlayerPrices)) {
    let best = null;
    for (const row of raw.tcgPlayerPrices) {
      const n = row?.market ?? row?.mid ?? row?.low;
      if (typeof n === "number" && Number.isFinite(n) && (best == null || n > best)) best = n;
    }
    if (best != null) return best;
  }
  const cm = raw.cardMarket;
  if (cm && typeof cm === "object") {
    for (const key of ["trendPrice", "averageSellPrice", "avg30", "avg7", "lowPrice"]) {
      const n = cm[key];
      if (typeof n === "number" && Number.isFinite(n)) return n;
    }
  }
  return null;
}

function isTrainerOrUtility(row) {
  const rarity = String(row.rarity ?? "").toLowerCase();
  if (rarity.includes("trainer") || rarity.includes("energy")) return true;
  const name = String(row.name ?? "").toLowerCase();
  if (
    /\b(ball|town|village|forest|path|beach|artistry|research|combat|counter|mystery|technical|special|double|rescue|choice|feather|hyper|impostor|lucky|revive|super|tool|treasure|vitality|tower|factory|shop|center|hospital|garden|temple|ruins|stadium|lid|lid|lid)\b/i.test(
      name,
    )
  ) {
    return true;
  }
  if (/energy$/i.test(name) || /^basic\s/i.test(name)) return true;
  return false;
}

function isPokemonChase(row) {
  if (isTrainerOrUtility(row)) return false;
  const name = String(row.name ?? "");
  if (/\b(ex|vstar|vmax| gx| v)\b/i.test(name)) return true;
  const rarity = String(row.rarity ?? "").toLowerCase();
  return rarity.includes("rare") || rarity.includes("illustration") || rarity.includes("hyper");
}

function chaseScore(row) {
  if (isTrainerOrUtility(row)) return -10_000;
  const rarity = String(row.rarity ?? "").toLowerCase();
  let score = 0;
  if (rarity.includes("special illustration")) score += 8_000;
  else if (rarity.includes("hyper rare")) score += 7_000;
  else if (rarity.includes("secret")) score += 6_000;
  else if (rarity.includes("illustration rare")) score += 5_000;
  else if (rarity.includes("ultra rare")) score += 4_000;
  else if (rarity.includes("double rare")) score += 3_000;
  else if (rarity.includes("rare")) score += 1_500;

  const numRaw = String(row.card_number ?? "").trim();
  const [numPart, totalPart] = numRaw.split("/");
  const num = Number.parseInt(numPart, 10);
  const total = Number.parseInt(totalPart, 10);
  if (Number.isFinite(num)) score += num;
  if (Number.isFinite(num) && Number.isFinite(total) && num > total) score += 4_000;
  return score;
}

function isJaEnergyCard(card) {
  const name = String(card?.name ?? "");
  return /エネルギー|energy/i.test(name);
}

function isJaTrainerOrUtility(card) {
  const name = String(card?.name ?? "");
  if (isJaEnergyCard(card)) return true;
  if (/ボール|タウン|ビレッジ|スタジアム|研究所|博士|グズマ|マリィ|ネモ|ペパー|ボスの指令|ふしぎ|どうぐ|サポート|スタジアム/i.test(name)) {
    return true;
  }
  return false;
}

function uniformRow(input) {
  return {
    baseCatalogId: input.baseCatalogId,
    language: LANGUAGE,
    localizedCatalogId: input.localizedCatalogId,
    localizedSetCode: input.localizedSetCode ?? null,
    localizedSetName: input.localizedSetName ?? null,
    localizedName: input.localizedName ?? null,
    printedNumber: input.printedNumber ?? "",
    counterpartNumber: input.counterpartNumber ?? null,
    imageBaseUrl: input.imageBaseUrl,
    matchConfidence: input.matchConfidence ?? MIN_CONFIDENCE,
    artworkMatchStatus: "exact_japanese_print",
    matchMethod: input.matchMethod ?? "set_number_match",
    source: "tcgdex",
  };
}

function catalogEnSetCandidates(jaSetId) {
  const out = [];
  for (const [en, ja] of Object.entries(STATIC_EN_TO_JA_SET)) {
    if (ja === jaSetId) out.push(en);
  }
  return out;
}

async function resolveCatalogEnSetId(supabase, jaSetId) {
  for (const enId of catalogEnSetCandidates(jaSetId, null)) {
    const { data } = await supabase
      .from("tcg_catalog_sets")
      .select("external_set_id")
      .eq("franchise", "pokemon")
      .eq("external_set_id", enId)
      .maybeSingle();
    if (data?.external_set_id) return data.external_set_id;
  }
  return null;
}

function pickJaShowcaseCard(jaCards) {
  const withImage = jaCards.filter((c) => c?.image && !isJaTrainerOrUtility(c));
  if (!withImage.length) return null;
  const exLike = withImage.filter((c) => /ex|VMAX|VSTAR|Ｖ\b|V\b/i.test(String(c.name ?? "")));
  const pool = exLike.length > 0 ? exLike : withImage;
  return pool.sort((a, b) => {
    const na = Number.parseInt(String(a.localId ?? "").replace(/\D/g, ""), 10) || 0;
    const nb = Number.parseInt(String(b.localId ?? "").replace(/\D/g, ""), 10) || 0;
    return nb - na;
  })[0];
}

async function findEnCatalogForJaCard(supabase, enSetId, jaBrief, jaFull) {
  const name = String(jaFull?.name ?? jaBrief?.name ?? "").trim();
  if (!name) return null;

  const { data: setRow } = await supabase
    .from("tcg_catalog_sets")
    .select("code,name")
    .eq("franchise", "pokemon")
    .eq("external_set_id", enSetId)
    .maybeSingle();

  const code = setRow?.code?.trim();
  if (!code) return null;

  const num = String(jaFull?.localId ?? jaBrief?.localId ?? "").trim();
  let query = supabase
    .from("tcg_catalog_cards")
    .select("catalog_id,name,set_name,set_code,card_number,prices_json")
    .eq("franchise", "pokemon")
    .eq("set_code", code)
    .limit(80);

  if (num) {
    query = query.or(`card_number.eq.${num},card_number.ilike.${num}/%`);
  }

  const { data } = await query;
  if (!data?.length) return null;

  let best = data[0];
  for (const row of data) {
    const price = bestCatalogUsd(row.prices_json);
    if ((price ?? 0) > (bestCatalogUsd(best.prices_json) ?? 0)) best = row;
  }
  return best;
}

function parseRelease(value) {
  if (!value) return 9_999;
  const t = Date.parse(String(value));
  return Number.isFinite(t) ? t : 9_999;
}

async function topEnChaseCardForSet(supabase, setCode) {
  const code = String(setCode ?? "").trim();
  if (!code) return null;

  const { data } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id,name,set_name,set_code,card_number,rarity,prices_json")
    .eq("franchise", "pokemon")
    .eq("set_code", code)
    .limit(500);

  if (!data?.length) return null;

  const pool = data.filter(isPokemonChase);
  const candidates = pool.length > 0 ? pool : data.filter((row) => !isTrainerOrUtility(row));

  let best = null;
  let bestScore = -1;
  for (const row of candidates) {
    const price = bestCatalogUsd(row.prices_json);
    const score = (price != null ? price * 1_000 : 0) + chaseScore(row);
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

async function mapPool(items, concurrency, fn) {
  const results = [];
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => worker()),
  );
  return results;
}

async function main() {
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  console.log("Building EN↔JA set map…");
  const enToJa = await buildEnJaSetMap();
  console.log(`  ${enToJa.size} EN→JA mappings`);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Scanning JA sets with TCGdex image coverage…");
  const jaSetList = await fetchAllSets("ja");
  const jaWithImages = [];

  const scanned = await mapPool(jaSetList, 12, async (brief) => {
    if (!brief.id) return null;
    const detail = await getJaSetDetail(brief.id);
    if (!detail) return null;
    if (detail.withImage < Math.max(12, Math.floor(detail.official * 0.45))) return null;
    return {
      ...detail,
      releaseSort: parseRelease(detail.releaseDate ?? brief.releaseDate),
    };
  });

  for (const row of scanned) {
    if (row) jaWithImages.push(row);
  }

  jaWithImages.sort((a, b) => a.releaseSort - b.releaseSort);
  console.log(`  ${jaWithImages.length} JA set(s) with image coverage`);

  const work = [];
  for (const jaSet of jaWithImages) {
    const enSetId = await resolveCatalogEnSetId(supabase, jaSet.id);
    if (!enSetId) continue;
    const { data: setRow } = await supabase
      .from("tcg_catalog_sets")
      .select("code,release_date")
      .eq("franchise", "pokemon")
      .eq("external_set_id", enSetId)
      .maybeSingle();
    const code = setRow?.code?.trim();
    if (!code) continue;
    work.push({
      enSetId,
      setCode: code,
      releaseSort: jaSet.releaseSort,
      jaSetId: jaSet.id,
    });
  }

  console.log(`  ${work.length} JA set(s) linked to EN catalog (static pairs only)`);

  const rows = [];
  const seen = new Set();
  const built = await mapPool(work, JA_SET_CONCURRENCY, async (item) => {
    const jaSet = await getJaSetDetail(item.jaSetId);
    if (!jaSet) return null;

    const enCard = await topEnChaseCardForSet(supabase, item.setCode);
    if (!enCard) return null;

    let matchedBrief = pickJaCardInSet(jaSet.cards, enCard);
    if (matchedBrief && isJaTrainerOrUtility(matchedBrief)) matchedBrief = null;
    let brief = matchedBrief;
    if (!brief?.id) brief = pickJaShowcaseCard(jaSet.cards);
    if (!brief?.id) return null;

    const full = await fetchCard("ja", brief.id);
    const image = full?.image ?? brief.image;
    if (!image) return null;

    const base = matchedBrief
      ? enCard
      : (await findEnCatalogForJaCard(supabase, item.enSetId, brief, full)) ?? enCard;
    if (!base?.catalog_id) return null;

    const matchedByNumber = Boolean(matchedBrief);

    return {
      jaHadImages: true,
      row: uniformRow({
      baseCatalogId: base.catalog_id,
      localizedCatalogId: full?.id ?? brief.id,
      localizedSetCode: jaSet.id,
      localizedSetName: jaSet.name,
      localizedName: full?.name ?? brief.name,
      printedNumber: full?.localId ?? brief.localId ?? "",
      counterpartNumber: base.card_number ?? enCard.card_number ?? null,
      imageBaseUrl: image,
      matchConfidence: matchedByNumber ? 0.94 : 0.92,
      matchMethod: matchedByNumber ? "set_number_match" : "curated_mapping",
      }),
    };
  });

  const jaSetsWithImages = built.filter((entry) => entry?.jaHadImages).length;

  for (const entry of built) {
    const row = entry?.row;
    if (!row || seen.has(row.baseCatalogId)) continue;
    seen.add(row.baseCatalogId);
    rows.push(row);
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    methodology:
      "Uniform overlay: verified STATIC EN↔JA set pairs, TCGdex JA images only, one chase card per JA set (vintage→modern). Prices stay on tcg_catalog_cards; artwork on tcg_catalog_localized_artwork.",
    language: LANGUAGE,
    minMatchConfidence: MIN_CONFIDENCE,
    jaSetsWithImages,
    rowCount: rows.length,
    rows,
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${rows.length} uniform row(s) → ${OUT}`);
  if (rows.length > 0) {
    console.log(`  First: ${rows[0].localizedSetName} · ${rows[0].localizedName}`);
    console.log(`  Last:  ${rows[rows.length - 1].localizedSetName} · ${rows[rows.length - 1].localizedName}`);
  }
  console.log("\nNext: npm run catalog:refresh:pokemon-japanese-artwork");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
