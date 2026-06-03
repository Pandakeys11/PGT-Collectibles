import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import {
  buildCatalogMatch,
  buildCatalogSearchText,
  normalizeCatalogToken,
  scoreNameSetNumber,
} from "@/lib/market/catalog-match-utils";
import { mergeCatalogMatches } from "@/lib/market/catalog-candidate-merge";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { effectiveCatalogSearchName } from "@/lib/scan/card-display";
import { parseCollectorFraction } from "@/lib/scan/collector-fraction";
import type { CardFranchise } from "@/lib/scan/franchise";
import {
  applyCatalogIdentityHardening,
  detectSameArtCatalogCollision,
  needsVariantAwareCatalogSearch,
  reprintSetCodesForSearch,
  requestedCatalogVariantFromCard,
  scoreSameArtCatalogRow,
} from "@/lib/scan/same-art-disambiguation";
import {
  detectVintagePrintCatalogCollision,
  scoreVintagePrintCatalogRow,
  vintagePrintRunSetCodesForSearch,
} from "@/lib/scan/vintage-print-run";
import { toCatalogCounterpartCard } from "@/lib/scan/japanese-pokemon";
import { resolvePrintEdition } from "@/lib/scan/print-edition";
import type { ExtractedCard, IdentityEvidence } from "@/lib/scan/schemas";

type DbCatalogRow = {
  catalog_id: string;
  name: string;
  printed_name: string | null;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  year: string | null;
  rarity: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  prices_json: Record<string, unknown> | null;
  raw_json: Record<string, unknown> | null;
  set_total?: number | null;
};

function asTrimmed(s: string | undefined | null): string {
  return (s ?? "").trim();
}

function escapeIlike(s: string): string {
  return s.replace(/[%_]/g, "");
}

function looksLikeSetCode(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  if (s.length > 16) return false;
  return /^[a-z0-9-]+$/i.test(s);
}

function requestedCatalogVariantKey(card: Pick<ExtractedCard, "printStamps" | "details" | "rarity" | "set">): string | null {
  const id = requestedCatalogVariantFromCard(card);
  if (id && ["reverse_holo", "unlimited", "first_edition", "shadowless"].includes(id)) {
    return id;
  }
  return null;
}

export async function searchDbCatalog(
  card: ExtractedCard,
  franchise: CardFranchise,
): Promise<CatalogMatch | null> {
  if (!isSupabaseConfigured()) return null;
  const catalogCard = applyCatalogIdentityHardening(toCatalogCounterpartCard(card));
  const name = effectiveCatalogSearchName(catalogCard);
  if (!name) return null;

  const supabase = getSupabaseAdmin();
  const searchBlob = buildCatalogSearchText([
    name,
    catalogCard.printedName,
    catalogCard.set,
    catalogCard.number,
    parseCollectorFraction(catalogCard.number)?.num,
    catalogCard.year,
  ]);

  const variantKey = requestedCatalogVariantKey(catalogCard);

  const baseQuery = () => {
    let query = supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
      )
      .eq("franchise", franchise)
      .limit(24);
    if (!variantKey) {
      query = query.is("raw_json->>catalogVariantKey", null);
    }
    return query;
  };

  const setNeedle = asTrimmed(catalogCard.set);
  const numberNeedle = asTrimmed(parseCollectorFraction(catalogCard.number)?.num ?? catalogCard.number);
  const nameEsc = escapeIlike(name.slice(0, 48));
  if (variantKey && numberNeedle) {
    const variantQuery = baseQuery()
      .eq("raw_json->>catalogVariantKey", variantKey)
      .ilike("name", `%${nameEsc}%`)
      .ilike("card_number", `${escapeIlike(numberNeedle)}%`);
    const { data, error } = await variantQuery.limit(12);
    if (!error && data?.length) {
      return rowsToMatch(catalogCard, franchise, data as DbCatalogRow[], searchBlob);
    }
  }

  const tryQueries: Array<() => ReturnType<typeof baseQuery>> = [];

  if (numberNeedle) {
    const numberEsc = escapeIlike(numberNeedle);

    // 0) Name + collector number (ignore vision set — common OCR hallucination).
    tryQueries.push(() =>
      baseQuery().ilike("name", `%${nameEsc}%`).ilike("card_number", `${numberEsc}%`),
    );
    tryQueries.push(() =>
      baseQuery().ilike("name", `%${nameEsc}%`).ilike("card_number", `%${numberEsc}%`),
    );

    // 1) Highest precision: set_code + card_number.
    if (setNeedle && looksLikeSetCode(setNeedle)) {
      tryQueries.push(() => baseQuery().eq("set_code", setNeedle).ilike("card_number", `${numberEsc}%`));
      tryQueries.push(() => baseQuery().eq("set_code", setNeedle).ilike("card_number", `%${numberEsc}%`));
    }

    // 2) set_name + card_number.
    if (setNeedle) {
      const setEsc = escapeIlike(setNeedle.slice(0, 64));
      tryQueries.push(() =>
        baseQuery().ilike("set_name", `%${setEsc}%`).ilike("card_number", `${numberEsc}%`),
      );
      tryQueries.push(() =>
        baseQuery().ilike("set_name", `%${setEsc}%`).ilike("card_number", `%${numberEsc}%`),
      );
    }

    // 3) card_number alone, then use name as a secondary filter to reduce collisions.
    tryQueries.push(() =>
      baseQuery().ilike("card_number", `${numberEsc}%`).ilike("name", `%${nameEsc}%`),
    );
    tryQueries.push(() =>
      baseQuery().ilike("card_number", `%${numberEsc}%`).ilike("name", `%${nameEsc}%`),
    );
  } else {
    if (setNeedle) {
      const setEsc = escapeIlike(setNeedle.slice(0, 64));
      tryQueries.push(() => baseQuery().ilike("name", `%${nameEsc}%`).ilike("set_name", `%${setEsc}%`));
    }
    tryQueries.push(() => baseQuery().ilike("name", `%${nameEsc}%`));
  }

  for (const makeQuery of tryQueries) {
    const { data, error } = await makeQuery();
    if (!error && data?.length) {
      return rowsToMatch(catalogCard, franchise, data as DbCatalogRow[], searchBlob);
    }
  }

  if (needsVariantAwareCatalogSearch(catalogCard) && numberNeedle) {
    const numberEsc = escapeIlike(numberNeedle);
    for (const setCode of reprintSetCodesForSearch(catalogCard)) {
      const { data, error } = await supabase
        .from("tcg_catalog_cards")
        .select(
          "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
        )
        .eq("franchise", franchise)
        .eq("set_code", setCode)
        .ilike("name", `%${nameEsc}%`)
        .ilike("card_number", `${numberEsc}%`)
        .limit(12);
      if (!error && data?.length) {
        return rowsToMatch(catalogCard, franchise, data as DbCatalogRow[], searchBlob);
      }
    }
    if (variantKey === "reverse_holo") {
      const { data, error } = await supabase
        .from("tcg_catalog_cards")
        .select(
          "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json",
        )
        .eq("franchise", franchise)
        .eq("raw_json->>catalogVariantKey", "reverse_holo")
        .ilike("name", `%${nameEsc}%`)
        .ilike("card_number", `${numberEsc}%`)
        .limit(12);
      if (!error && data?.length) {
        return rowsToMatch(catalogCard, franchise, data as DbCatalogRow[], searchBlob);
      }
    }
  }

  const tsQuery = searchBlob
    .split(" ")
    .filter((t) => t.length > 2)
    .slice(0, 4)
    .join(" & ");
  if (!tsQuery) return null;

  const fallback = await baseQuery().textSearch("search_text", tsQuery, { type: "websearch" }).limit(16);
  if (fallback.error || !fallback.data?.length) return null;
  return rowsToMatch(catalogCard, franchise, fallback.data as DbCatalogRow[], searchBlob);
}

/** Official printed denominators when API `card_count` differs (e.g. Team Rocket /82 vs 83 rows). */
const PRINTED_TOTAL_BY_SET_CODE: Record<string, number> = {
  base5: 82,
};

async function hydrateSetTotals(
  franchise: CardFranchise,
  rows: DbCatalogRow[],
): Promise<DbCatalogRow[]> {
  const setCodes = Array.from(
    new Set(rows.map((row) => row.set_code?.trim()).filter((value): value is string => Boolean(value))),
  );
  if (setCodes.length === 0 || !isSupabaseConfigured()) return rows;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tcg_catalog_sets")
    .select("external_set_id,code,card_count")
    .eq("franchise", franchise)
    .in("external_set_id", setCodes);
  if (error || !data?.length) return rows;

  const totals = new Map<string, number>();
  for (const row of data as Array<{ external_set_id?: string | null; code?: string | null; card_count?: number | null }>) {
    const total = typeof row.card_count === "number" && Number.isFinite(row.card_count) ? row.card_count : null;
    if (!total) continue;
    if (row.external_set_id) totals.set(row.external_set_id, total);
    if (row.code) totals.set(row.code, total);
  }

  return rows.map((row) => ({
    ...row,
    set_total: row.set_code
      ? PRINTED_TOTAL_BY_SET_CODE[row.set_code] ?? totals.get(row.set_code) ?? null
      : null,
  }));
}

function displayCardNumberForRow(card: ExtractedCard, row: DbCatalogRow): string | null {
  const raw = row.card_number?.trim() ?? "";
  if (!raw) return null;
  const requestedFraction = parseCollectorFraction(card.number);
  if (requestedFraction && !raw.includes("/") && row.set_total) {
    return `${raw}/${row.set_total}`;
  }
  return raw;
}

function displaySetNameForRow(row: DbCatalogRow): string | null {
  const setName = row.set_name?.trim() ?? null;
  if (row.set_code === "base1" && normalizeCatalogToken(setName) === "base") {
    return "Base Set";
  }
  return setName;
}

function rowCatalogVariantKey(row: DbCatalogRow): string | null {
  const raw = row.raw_json ?? {};
  const key = raw.catalogVariantKey;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function rowCatalogVariantLabel(row: DbCatalogRow): string | null {
  const raw = row.raw_json ?? {};
  const label = raw.variantLabel;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}

function hardCatalogConflictCount(row: { conflicts: string[] }): number {
  return row.conflicts.filter((conflict) => /^(name|number|print_variant)$/i.test(conflict)).length;
}

function finalCatalogScore(score: number, conflicts: string[]): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (conflicts.some((conflict) => /^(name|number|print_variant)$/i.test(conflict))) {
    return Math.min(74, clamped);
  }
  if (conflicts.includes("set")) {
    return Math.min(88, clamped);
  }
  return clamped;
}

function hasReason(row: { reasons: string[] } | undefined, reason: string): boolean {
  return Boolean(row?.reasons.includes(reason));
}

/** Adjacent collector numbers in the same set are distinct cards (Neo Typhlosion 17 vs 18). */
function collectorNumeratorsAllowOcrCorrection(
  cardNumber: string | undefined,
  hitNumber: string | undefined,
): boolean {
  const cardFrac = parseCollectorFraction(cardNumber);
  const hitFrac = parseCollectorFraction(hitNumber);
  if (!cardFrac || !hitFrac) return false;
  if (cardFrac.den !== hitFrac.den) return false;
  if (cardFrac.num === hitFrac.num) return true;
  const a = Number(cardFrac.num);
  const b = Number(hitFrac.num);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (Math.abs(a - b) === 1) return false;
  return true;
}

function removeConflict(conflicts: string[], conflict: string): void {
  const index = conflicts.indexOf(conflict);
  if (index >= 0) conflicts.splice(index, 1);
}

function catalogSetKey(value: string | null | undefined): string {
  const normalized = normalizeCatalogToken(value);
  if (normalized === "base") return "base set";
  if (normalized === "legendary collection" || normalized === "legendary coll") {
    return "legendary collection";
  }
  return normalized;
}

async function rowsToMatch(
  card: ExtractedCard,
  franchise: CardFranchise,
  rows: DbCatalogRow[],
  searchBlob: string,
): Promise<CatalogMatch | null> {
  const hydratedRows = await hydrateSetTotals(franchise, rows);
  const frac = parseCollectorFraction(card.number);
  const printEdition = resolvePrintEdition(card);
  const scored = hydratedRows.map((row) => {
    const hitName = row.printed_name?.trim() || row.name;
    const hitSetName = displaySetNameForRow(row);
    const cardNumber = displayCardNumberForRow(card, row);
    const result = scoreNameSetNumber(card, {
      name: hitName,
      setName: hitSetName,
      cardNumber,
      year: row.year,
    });
    const prices = (row.prices_json ?? {}) as {
      tcgPlayerUrl?: string | null;
    };
    const requestedSet = catalogSetKey(card.set);
    const hitSet = catalogSetKey(hitSetName);
    const requestedName = normalizeCatalogToken(card.name ?? card.printedName);
    const exactSet = Boolean(requestedSet && hitSet && requestedSet === hitSet);
    const exactName = Boolean(requestedName && normalizeCatalogToken(hitName) === requestedName);
    let score =
      result.score +
      (buildCatalogSearchText([hitName, row.set_name, row.card_number]) === searchBlob ? 5 : 0);
    const reasons = [...result.reasons, "db_cache"];
    const conflicts = [...result.conflicts];

    if (requestedSet === "base set" && hitSet && hitSet !== "base set" && reasons.includes("set")) {
      score -= 18;
      reasons.splice(reasons.indexOf("set"), 1);
      if (!conflicts.includes("set")) conflicts.push("set");
    }

    const sameArt = scoreSameArtCatalogRow(
      card,
      {
        setName: hitSetName,
        setCode: row.set_code,
        setTotal: row.set_total ?? null,
        variantKey: rowCatalogVariantKey(row),
      },
      printEdition ?? null,
    );
    score += sameArt.scoreDelta;
    for (const reason of sameArt.reasons) {
      if (!reasons.includes(reason)) reasons.push(reason);
    }
    for (const conflict of sameArt.conflicts) {
      if (!conflicts.includes(conflict)) conflicts.push(conflict);
    }

    const vintagePrint = scoreVintagePrintCatalogRow(
      card,
      { catalogId: row.catalog_id, variantKey: rowCatalogVariantKey(row) },
      printEdition ?? null,
    );
    score += vintagePrint.scoreDelta;
    for (const reason of vintagePrint.reasons) {
      if (!reasons.includes(reason)) reasons.push(reason);
    }
    for (const conflict of vintagePrint.conflicts) {
      if (!conflicts.includes(conflict)) conflicts.push(conflict);
    }

    if (vintagePrint.reasons.includes("print_variant")) {
      removeConflict(conflicts, "print_variant");
    }

    if (frac && row.set_total === frac.den) {
      score += 28;
      reasons.push("denominator");
      removeConflict(conflicts, "set");
      if (
        exactName &&
        exactSet &&
        conflicts.includes("number") &&
        collectorNumeratorsAllowOcrCorrection(card.number ?? undefined, cardNumber ?? undefined)
      ) {
        score += 30;
        reasons.push("number_ocr_corrected");
        removeConflict(conflicts, "number");
      }
    }
    const finalScore = finalCatalogScore(score, conflicts);
    return {
      catalogId: row.catalog_id,
      name: rowCatalogVariantLabel(row) ? `${hitName} (${rowCatalogVariantLabel(row)})` : hitName,
      setName: hitSetName,
      cardNumber,
      year: row.year,
      rarity: row.rarity,
      score: finalScore,
      confidence: finalScore / 100,
      reasons,
      conflicts,
      imageSmallUrl: row.image_small_url,
      imageLargeUrl: row.image_large_url,
      prices: {
        tcgPlayerUrl: prices.tcgPlayerUrl ?? null,
        tcgPlayerUpdatedAt: null,
        tcgPlayerPrices: [],
        cardMarketUrl: null,
        cardMarketUpdatedAt: null,
        cardMarket: null,
      },
    };
  });

  const sorted = [...scored].sort((a, b) => {
    const scoreGap = b.score - a.score;
    if (scoreGap !== 0) return scoreGap;
    const conflictGap = hardCatalogConflictCount(a) - hardCatalogConflictCount(b);
    if (conflictGap !== 0) return conflictGap;
    const numberGap = Number(hasReason(b, "number")) - Number(hasReason(a, "number"));
    if (numberGap !== 0) return numberGap;
    const denomGap = Number(hasReason(b, "denominator")) - Number(hasReason(a, "denominator"));
    if (denomGap !== 0) return denomGap;
    const variantGap = Number(hasReason(b, "print_variant")) - Number(hasReason(a, "print_variant"));
    if (variantGap !== 0) return variantGap;
    const setGap = Number(hasReason(b, "set")) - Number(hasReason(a, "set"));
    if (setGap !== 0) return setGap;
    return a.catalogId.localeCompare(b.catalogId);
  });
  const top = sorted[0];
  const runnerUp = sorted[1];
  const gap = top ? top.score - (runnerUp?.score ?? 0) : 0;
  const denomOk = Boolean(frac && hasReason(top, "denominator"));
  const numOk = hasReason(top, "number");
  const nameOk = Boolean(top && !top.conflicts.includes("name"));
  const variantOk = hasReason(top, "print_variant");
  const setOk = hasReason(top, "set");
  const topHardConflicts = top ? hardCatalogConflictCount(top) : 0;

  const evidence: IdentityEvidence[] = [
    {
      field: "catalog",
      extracted: searchBlob,
      catalog: `Supabase tcg_catalog_cards (${franchise})`,
      status: "info",
      weight: 70,
      reason: "Matched cached catalog row synced from official API.",
    },
  ];
  if (denomOk && frac) {
    evidence.push({
      field: "set total",
      extracted: String(frac.den),
      catalog: String(top?.reasons.includes("denominator") ? frac.den : ""),
      status: "match",
      weight: 28,
      reason: "Printed denominator agrees with cached set total.",
    });
  }

  const matchBasis: CatalogMatch["matchBasis"] =
    denomOk && numOk && nameOk ? "fraction_total" : "strict";
  const match = buildCatalogMatch(sorted, evidence, matchBasis);
  if (!match || !top) return match;

  if (detectSameArtCatalogCollision(top, runnerUp)) {
    return {
      ...match,
      catalogIdentityStatus: "ambiguous",
      catalogConfidence: top.confidence,
      score: top.score,
    };
  }

  if (detectVintagePrintCatalogCollision(card, top, runnerUp)) {
    return {
      ...match,
      catalogIdentityStatus: "ambiguous",
      catalogConfidence: top.confidence,
      score: top.score,
    };
  }

  const requiresPrintVariant = Boolean(requestedCatalogVariantKey(card));
  if (requiresPrintVariant && !variantOk) {
    return {
      ...match,
      catalogIdentityStatus: "ambiguous",
      catalogConfidence: top.confidence,
      score: top.score,
    };
  }

  const vintageSingleVariantHit =
    requiresPrintVariant &&
    sorted.length === 1 &&
    variantOk &&
    topHardConflicts === 0;

  if (
    nameOk &&
    numOk &&
    topHardConflicts === 0 &&
    (denomOk || variantOk || setOk) &&
    top.score >= 82 &&
    (gap >= 8 || vintageSingleVariantHit)
  ) {
    return {
      ...match,
      catalogIdentityStatus: "confirmed",
      catalogConfidence: top.confidence,
      score: top.score,
      matchBasis: "fraction_total",
    };
  }

  return match;
}

/**
 * Wide DB search for manual pick UI — accumulates name / set / number hits even when
 * strict `searchDbCatalog` returns null (e.g. vision set typo, partial number).
 */
export async function searchDbCatalogBroad(
  card: ExtractedCard,
  franchise: CardFranchise,
): Promise<CatalogMatch | null> {
  if (!isSupabaseConfigured()) return null;
  const catalogCard = applyCatalogIdentityHardening(toCatalogCounterpartCard(card));
  const name = effectiveCatalogSearchName(catalogCard);
  if (!name) return null;

  const supabase = getSupabaseAdmin();
  const searchBlob = buildCatalogSearchText([
    name,
    catalogCard.printedName,
    catalogCard.set,
    catalogCard.number,
    parseCollectorFraction(catalogCard.number)?.num,
    catalogCard.year,
  ]);

  const selectCols =
    "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json";

  const variantKey = requestedCatalogVariantKey(catalogCard);

  const baseQuery = () => {
    let query = supabase
      .from("tcg_catalog_cards")
      .select(selectCols)
      .eq("franchise", franchise);
    if (!variantKey) {
      query = query.is("raw_json->>catalogVariantKey", null);
    }
    return query;
  };

  const seen = new Map<string, DbCatalogRow>();
  const absorb = (rows: DbCatalogRow[] | null | undefined) => {
    for (const row of rows ?? []) {
      if (row?.catalog_id && !seen.has(row.catalog_id)) seen.set(row.catalog_id, row as DbCatalogRow);
    }
  };

  const nameEsc = escapeIlike(name.slice(0, 48));
  const numberNeedle = asTrimmed(parseCollectorFraction(catalogCard.number)?.num ?? catalogCard.number);
  if (variantKey && numberNeedle) {
    absorb(
      (await supabase
        .from("tcg_catalog_cards")
        .select(selectCols)
        .eq("franchise", franchise)
        .eq("raw_json->>catalogVariantKey", variantKey)
        .ilike("name", `%${nameEsc}%`)
        .ilike("card_number", `${escapeIlike(numberNeedle)}%`)
        .limit(16)).data as DbCatalogRow[],
    );
  }
  absorb((await baseQuery().ilike("name", `%${nameEsc}%`).limit(20)).data as DbCatalogRow[]);

  if (numberNeedle) {
    const numberEsc = escapeIlike(numberNeedle);
    absorb(
      (await baseQuery()
        .ilike("card_number", `${numberEsc}%`)
        .ilike("name", `%${nameEsc}%`)
        .limit(16)).data as DbCatalogRow[],
    );
    absorb(
      (await baseQuery()
        .ilike("card_number", `%/${numberEsc}%`)
        .ilike("name", `%${nameEsc}%`)
        .limit(12)).data as DbCatalogRow[],
    );
  }

  const setNeedle = asTrimmed(catalogCard.set);
  if (setNeedle) {
    const setEsc = escapeIlike(setNeedle.slice(0, 64));
    absorb(
      (await baseQuery()
        .ilike("set_name", `%${setEsc}%`)
        .ilike("name", `%${nameEsc}%`)
        .limit(16)).data as DbCatalogRow[],
    );
    if (looksLikeSetCode(setNeedle)) {
      absorb(
        (await baseQuery().eq("set_code", setNeedle).ilike("name", `%${nameEsc}%`).limit(16))
          .data as DbCatalogRow[],
      );
    }
  }

  for (const setCode of [
    ...reprintSetCodesForSearch(catalogCard),
    ...vintagePrintRunSetCodesForSearch(catalogCard),
  ]) {
    if (!numberNeedle) continue;
    absorb(
      (await supabase
        .from("tcg_catalog_cards")
        .select(selectCols)
        .eq("franchise", franchise)
        .eq("set_code", setCode)
        .ilike("name", `%${nameEsc}%`)
        .ilike("card_number", `${escapeIlike(numberNeedle)}%`)
        .limit(12)).data as DbCatalogRow[],
    );
  }

  if (needsVariantAwareCatalogSearch(catalogCard) && numberNeedle && !variantKey) {
    absorb(
      (await supabase
        .from("tcg_catalog_cards")
        .select(selectCols)
        .eq("franchise", franchise)
        .eq("raw_json->>catalogVariantKey", "reverse_holo")
        .ilike("name", `%${nameEsc}%`)
        .ilike("card_number", `${escapeIlike(numberNeedle)}%`)
        .limit(12)).data as DbCatalogRow[],
    );
  }

  if (seen.size < 8) {
    const tsQuery = searchBlob
      .split(" ")
      .filter((t) => t.length > 2)
      .slice(0, 5)
      .join(" & ");
    if (tsQuery) {
      const fallback = await baseQuery()
        .textSearch("search_text", tsQuery, { type: "websearch" })
        .limit(16);
      if (!fallback.error) absorb(fallback.data as DbCatalogRow[]);
    }
  }

  if (seen.size === 0) return null;
  return rowsToMatch(catalogCard, franchise, [...seen.values()], searchBlob);
}

const DB_CATALOG_SELECT_COLS =
  "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json,raw_json";

function isExactSameNameCatalogRow(row: DbCatalogRow, normalizedTarget: string): boolean {
  return (
    normalizeCatalogToken(row.name) === normalizedTarget ||
    normalizeCatalogToken(row.printed_name) === normalizedTarget
  );
}

/** Fetch catalog rows sharing the extracted card name — for pick UI when art/number collide (e.g. Neo Typhlosion 17 vs 18). */
async function fetchSameNameCatalogRows(
  card: ExtractedCard,
  franchise: CardFranchise,
  skipIds: ReadonlySet<string>,
): Promise<DbCatalogRow[]> {
  if (!isSupabaseConfigured()) return [];
  const name = effectiveCatalogSearchName(card);
  if (!name || name.length < 2) return [];

  const normalizedTarget = normalizeCatalogToken(name);
  const supabase = getSupabaseAdmin();
  const nameEsc = escapeIlike(name.slice(0, 48));
  const found: DbCatalogRow[] = [];
  const seen = new Set(skipIds);

  const absorb = (rows: DbCatalogRow[] | null | undefined) => {
    for (const row of rows ?? []) {
      const id = row.catalog_id?.trim();
      if (!id || seen.has(id)) continue;
      if (!isExactSameNameCatalogRow(row, normalizedTarget)) continue;
      seen.add(id);
      found.push(row);
    }
  };

  const setNeedle = asTrimmed(card.set);
  if (setNeedle) {
    const setEsc = escapeIlike(setNeedle.slice(0, 64));
    const { data } = await supabase
      .from("tcg_catalog_cards")
      .select(DB_CATALOG_SELECT_COLS)
      .eq("franchise", franchise)
      .ilike("name", `%${nameEsc}%`)
      .ilike("set_name", `%${setEsc}%`)
      .limit(32);
    absorb(data as DbCatalogRow[]);
  }

  const { data: broad } = await supabase
    .from("tcg_catalog_cards")
    .select(DB_CATALOG_SELECT_COLS)
    .eq("franchise", franchise)
    .ilike("name", `%${nameEsc}%`)
    .limit(48);
  absorb(broad as DbCatalogRow[]);

  return found;
}

/**
 * Merge every same-name master-catalog row into pick options — even when the auto-match
 * score is below confirmation threshold (duplicate names in one set, same-art reprints).
 */
export async function supplementCatalogMatchSameNameVariants(
  card: ExtractedCard,
  franchise: CardFranchise,
  match: CatalogMatch | null,
): Promise<CatalogMatch | null> {
  if (!isSupabaseConfigured()) return match;

  const catalogCard = applyCatalogIdentityHardening(toCatalogCounterpartCard(card));
  const skipIds = new Set(match?.candidates.map((row) => row.catalogId) ?? []);
  const extraRows = await fetchSameNameCatalogRows(catalogCard, franchise, skipIds);
  if (extraRows.length === 0) return match;

  const searchBlob = buildCatalogSearchText([
    effectiveCatalogSearchName(catalogCard),
    catalogCard.printedName,
    catalogCard.set,
    catalogCard.number,
    parseCollectorFraction(catalogCard.number)?.num,
    catalogCard.year,
  ]);

  const extraMatch = await rowsToMatch(catalogCard, franchise, extraRows, searchBlob);
  if (!extraMatch) return match;
  const merged = mergeCatalogMatches(match, extraMatch);
  if (!match?.candidates[0]) return merged;

  const primaryTop = match.candidates[0];
  const keepPrimaryTop =
    match.catalogIdentityStatus === "confirmed" &&
    primaryTop.reasons.includes("number") &&
    !primaryTop.conflicts.includes("number");

  if (!keepPrimaryTop || !merged) return merged;

  const primaryId = primaryTop.catalogId;
  const reordered = [
    merged.candidates.find((row) => row.catalogId === primaryId),
    ...merged.candidates.filter((row) => row.catalogId !== primaryId),
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));

  const pinned = reordered[0];
  if (!pinned) return merged;

  return {
    ...merged,
    catalogId: pinned.catalogId,
    name: pinned.name,
    setName: pinned.setName,
    cardNumber: pinned.cardNumber,
    year: pinned.year,
    rarity: pinned.rarity,
    imageSmallUrl: pinned.imageSmallUrl,
    imageLargeUrl: pinned.imageLargeUrl,
    imageUrl: pinned.imageLargeUrl ?? pinned.imageSmallUrl ?? merged.imageUrl,
    score: pinned.score,
    catalogConfidence: pinned.confidence,
    candidates: reordered,
  };
}

export type CatalogCardUpsert = {
  franchise: CardFranchise | "sports";
  catalogId: string;
  name: string;
  printedName?: string | null;
  setName?: string | null;
  setCode?: string | null;
  cardNumber?: string | null;
  year?: string | null;
  rarity?: string | null;
  imageSmallUrl?: string | null;
  imageLargeUrl?: string | null;
  pricesJson?: Record<string, unknown>;
  rawJson?: Record<string, unknown>;
  sourceId: string;
};

/** Update prices_json only — preserves source_id and identity columns (PSA10 / FMV enrich). */
export async function patchCatalogCardPricesJson(
  franchise: CardFranchise | "sports",
  catalogId: string,
  pricesJson: Record<string, unknown>,
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const id = catalogId.trim();
  if (!id) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("tcg_catalog_cards")
    .update({
      prices_json: pricesJson,
      synced_at: new Date().toISOString(),
    })
    .eq("franchise", franchise)
    .eq("catalog_id", id);
  if (error) throw new Error(error.message);
}

export async function upsertCatalogCards(rows: CatalogCardUpsert[]): Promise<number> {
  if (!isSupabaseConfigured() || rows.length === 0) return 0;
  const supabase = getSupabaseAdmin();
  const payload = rows.map((row) => ({
    franchise: row.franchise,
    catalog_id: row.catalogId,
    name: row.name,
    printed_name: row.printedName ?? null,
    set_name: row.setName ?? null,
    set_code: row.setCode ?? null,
    card_number: row.cardNumber ?? null,
    year: row.year ?? null,
    rarity: row.rarity ?? null,
    image_small_url: row.imageSmallUrl ?? null,
    image_large_url: row.imageLargeUrl ?? null,
    search_text: buildCatalogSearchText([
      row.name,
      row.printedName,
      row.setName,
      row.setCode,
      row.cardNumber,
      row.year,
      row.rarity,
    ]),
    prices_json: row.pricesJson ?? {},
    raw_json: row.rawJson ?? {},
    source_id: row.sourceId,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("tcg_catalog_cards").upsert(payload, {
    onConflict: "franchise,catalog_id",
  });
  if (error) throw new Error(error.message);
  return payload.length;
}

export async function touchCatalogSourceSync(sourceId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  await supabase
    .from("tcg_catalog_sources")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", sourceId);
}
