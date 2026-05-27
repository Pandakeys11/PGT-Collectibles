import type {
  CatalogCandidate,
  CatalogIdentityStatus,
  ExtractedCard,
  IdentityEvidence,
} from "@/lib/scan/schemas";
import { parseCollectorFraction } from "@/lib/scan/collector-fraction";
import {
  canonicalPromoSetName,
  normalizePromoCardIdentity,
  promoSetNamesMatch,
  resolvePokemonPromoSet,
} from "@/lib/scan/promo-set-aliases";
import { pokemonTcgFetch } from "@/lib/pokemon-tcg-api-client";
import {
  catalogHitMatchesPrintedTotal,
  isEditionOnlySetName,
  setNamesMatch,
} from "@/lib/scan/set-identification";
import {
  resolveTcgDexAliases,
  type TcgDexAlias,
} from "@/lib/market/tcgdex-client";
import { effectiveCatalogSearchName } from "@/lib/scan/card-display";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { resolvePrintEdition } from "@/lib/scan/print-edition";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";

export type TcgPlayerVariantPrice = {
  variant: string;
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  directLow: number | null;
};

export type CardMarketPrices = {
  averageSellPrice: number | null;
  trendPrice: number | null;
  lowPrice: number | null;
  avg7: number | null;
  avg30: number | null;
  reverseHoloTrend: number | null;
};

export type CatalogPriceSnapshot = {
  tcgPlayerUrl: string | null;
  tcgPlayerUpdatedAt: string | null;
  tcgPlayerPrices: TcgPlayerVariantPrice[];
  cardMarketUrl: string | null;
  cardMarketUpdatedAt: string | null;
  cardMarket: CardMarketPrices | null;
};

export type CatalogMatch = {
  catalogId: string;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  year: string | null;
  rarity: string | null;
  /** Prefer for list thumbnails (sharp small art). */
  imageSmallUrl: string | null;
  /** Large art / fallback. */
  imageLargeUrl: string | null;
  /** Large art / fallback for callers expecting a single image field. */
  imageUrl: string | null;
  prices: CatalogPriceSnapshot;
  /** How this row was resolved against the Pokémon TCG API (for downstream merge policy). */
  matchBasis?: "fraction_total" | "strict" | "loose";
  catalogIdentityStatus: CatalogIdentityStatus;
  catalogConfidence: number;
  score: number;
  candidates: CatalogCandidate[];
  identityEvidence: IdentityEvidence[];
};

function escapeQueryValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

function releaseYear(releaseDate: string | undefined): string | null {
  if (!releaseDate) return null;
  const year = releaseDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function looksLikeCollectorNumber(value: string): boolean {
  return /\d/.test(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

type TcgPlayerVariantBlock = {
  low?: number;
  mid?: number;
  high?: number;
  market?: number;
  directLow?: number;
};

type PokemonTcgCard = {
  id: string;
  name: string;
  number?: string;
  rarity?: string;
  images?: { large?: string; small?: string };
  set?: {
    id?: string;
    name?: string;
    releaseDate?: string;
    printedTotal?: number;
    total?: number;
  };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<string, TcgPlayerVariantBlock>;
  };
  cardmarket?: {
    url?: string;
    updatedAt?: string;
    prices?: {
      averageSellPrice?: number;
      trendPrice?: number;
      lowPrice?: number;
      avg7?: number;
      avg30?: number;
      reverseHoloTrend?: number;
    };
  };
};

function normalizeTcgPlayerProductUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  let u = url.trim();
  if (u.startsWith("//")) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes("tcgplayer")) return u;
    return `https://www.tcgplayer.com${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function normalizeCardMarketProductUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  let u = url.trim();
  if (u.startsWith("//")) u = `https:${u}`;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes("cardmarket")) return u;
    return `https://www.cardmarket.com${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function buildPriceSnapshot(card: PokemonTcgCard): CatalogPriceSnapshot {
  const tcgPlayerPrices: TcgPlayerVariantPrice[] = [];
  const variants = card.tcgplayer?.prices ?? {};
  for (const [variant, block] of Object.entries(variants)) {
    tcgPlayerPrices.push({
      variant,
      low: asNumber(block?.low),
      mid: asNumber(block?.mid),
      high: asNumber(block?.high),
      market: asNumber(block?.market),
      directLow: asNumber(block?.directLow),
    });
  }

  const cm = card.cardmarket?.prices;
  const cardMarket: CardMarketPrices | null = cm
    ? {
        averageSellPrice: asNumber(cm.averageSellPrice),
        trendPrice: asNumber(cm.trendPrice),
        lowPrice: asNumber(cm.lowPrice),
        avg7: asNumber(cm.avg7),
        avg30: asNumber(cm.avg30),
        reverseHoloTrend: asNumber(cm.reverseHoloTrend),
      }
    : null;

  return {
    tcgPlayerUrl: normalizeTcgPlayerProductUrl(card.tcgplayer?.url ?? null),
    tcgPlayerUpdatedAt: card.tcgplayer?.updatedAt ?? null,
    tcgPlayerPrices,
    cardMarketUrl: normalizeCardMarketProductUrl(card.cardmarket?.url ?? null),
    cardMarketUpdatedAt: card.cardmarket?.updatedAt ?? null,
    cardMarket,
  };
}

function toCatalogMatch(
  card: PokemonTcgCard,
  matchBasis?: CatalogMatch["matchBasis"],
  scored?: {
    status: CatalogIdentityStatus;
    score: number;
    confidence: number;
    candidates: CatalogCandidate[];
    evidence: IdentityEvidence[];
  },
): CatalogMatch {
  const small = card.images?.small ?? null;
  const large = card.images?.large ?? null;
  return {
    catalogId: card.id,
    name: card.name,
    setName: card.set?.name ?? null,
    cardNumber: card.number ?? null,
    year: releaseYear(card.set?.releaseDate),
    rarity: card.rarity ?? null,
    imageSmallUrl: small,
    imageLargeUrl: large,
    imageUrl: large ?? small,
    prices: buildPriceSnapshot(card),
    matchBasis,
    catalogIdentityStatus: scored?.status ?? "likely",
    catalogConfidence: scored?.confidence ?? 0.7,
    score: scored?.score ?? 70,
    candidates: scored?.candidates ?? [],
    identityEvidence: scored?.evidence ?? [],
  };
}

async function fetchCatalogCards(
  query: string,
  pageSize: number,
  options?: { orderByNumber?: boolean },
): Promise<PokemonTcgCard[]> {
  const order = options?.orderByNumber ? "&orderBy=number" : "";
  const path = `/cards?q=${encodeURIComponent(query)}&pageSize=${pageSize}${order}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await pokemonTcgFetch(path, {
        kind: "scan",
        cache: "no-store",
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { data?: PokemonTcgCard[] };
      return payload.data ?? [];
    } catch {
      if (attempt === 1) return [];
    }
  }
  return [];
}

type ScoredCatalogCandidate = CatalogCandidate & {
  card: PokemonTcgCard;
  evidence: IdentityEvidence[];
};

function normalizeIdentityText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.-]/g, "")
    .replace(/\s+/g, " ");
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function candidateYear(card: PokemonTcgCard): string | null {
  return releaseYear(card.set?.releaseDate);
}

function cardNumberHead(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const frac = parseCollectorFraction(text);
  if (frac) return frac.num;
  const match = text.match(/^#?\s*([A-Z]{0,5}\s*\d+[a-z]?)\s*(?:\/\s*\d+)?$/i);
  return (
    match?.[1]?.replace(/\s+/g, "").toLowerCase() ??
    text.replace(/\s+/g, "").toLowerCase()
  );
}

function exactCatalogNumber(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

function pushEvidence(
  evidence: IdentityEvidence[],
  args: Omit<IdentityEvidence, "weight"> & { weight?: number },
): number {
  const weight = args.weight ?? 0;
  evidence.push({ ...args, weight });
  return weight;
}

function scoreCatalogCandidate(
  card: ExtractedCard,
  hit: PokemonTcgCard,
  aliases: TcgDexAlias[] = [],
): ScoredCatalogCandidate {
  const evidence: IdentityEvidence[] = [];
  const reasons: string[] = [];
  const conflicts: string[] = [];
  let score = 0;
  const alias = aliases.find(
    (row) => row.tcgdexId.toLowerCase() === hit.id.toLowerCase(),
  );
  const scoringCard: ExtractedCard = alias
    ? {
        ...card,
        name: alias.englishName,
        set: card.set?.trim() || alias.englishSetName || undefined,
        number: card.number?.trim() || alias.englishNumber || undefined,
      }
    : card;

  if (alias) {
    score += pushEvidence(evidence, {
      field: "multilingual alias",
      extracted: [alias.language, alias.printedName]
        .filter(Boolean)
        .join(" · "),
      catalog: alias.englishName,
      status: "match",
      weight: 32,
      reason: "TCGdex localized card maps to this English catalog identity.",
    });
    reasons.push(`tcgdex ${alias.language}`);
  }

  const extractedName = scoringCard.name?.trim() ?? "";
  const catalogName = hit.name;
  const nameA = normalizeIdentityText(extractedName);
  const nameB = normalizeIdentityText(catalogName);
  if (nameA && nameB && nameA === nameB) {
    score += pushEvidence(evidence, {
      field: "name",
      extracted: extractedName,
      catalog: catalogName,
      status: "match",
      weight: 35,
      reason: "Exact card name match.",
    });
    reasons.push("exact name");
  } else if (
    nameA &&
    nameB &&
    (nameA.includes(nameB) || nameB.includes(nameA))
  ) {
    score += pushEvidence(evidence, {
      field: "name",
      extracted: extractedName,
      catalog: catalogName,
      status: "match",
      weight: 22,
      reason: "Close card name match.",
    });
    reasons.push("close name");
  } else {
    score += pushEvidence(evidence, {
      field: "name",
      extracted: extractedName || null,
      catalog: catalogName,
      status: "conflict",
      weight: -45,
      reason: "Card name conflicts with catalog result.",
    });
    conflicts.push("name conflict");
  }

  const frac = parseCollectorFraction(scoringCard.number);
  const extractedSet = scoringCard.set?.trim() ?? "";
  const catalogSet = hit.set?.name ?? null;
  const promoResolved = resolvePokemonPromoSet(extractedSet);
  const promoSetIdMatch =
    promoResolved != null &&
    (hit.set?.id ?? "").trim().toLowerCase() === promoResolved.setId.toLowerCase();
  if (extractedSet && !isEditionOnlySetName(extractedSet)) {
    const denomMatches = frac ? catalogHitMatchesPrintedTotal(hit, frac.den) : false;
    if (
      setNamesMatch(catalogSet ?? undefined, extractedSet) ||
      promoSetNamesMatch(catalogSet ?? undefined, extractedSet) ||
      promoSetIdMatch
    ) {
      score += pushEvidence(evidence, {
        field: "set",
        extracted: extractedSet,
        catalog: promoSetIdMatch ? `${catalogSet} (${hit.set?.id})` : catalogSet,
        status: "match",
        weight: promoSetIdMatch ? 24 : 18,
        reason: promoSetIdMatch
          ? "Promo set id agrees with catalog."
          : "Set name agrees with catalog.",
      });
      reasons.push(promoSetIdMatch ? "set.id" : "set");
    } else if (denomMatches && nameA && nameB && (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA))) {
      score += pushEvidence(evidence, {
        field: "set",
        extracted: extractedSet,
        catalog: catalogSet,
        status: "info",
        weight: -6,
        reason: "Vision set misread — printed total + name agree with catalog.",
      });
      reasons.push("set_misread");
    } else {
      score += pushEvidence(evidence, {
        field: "set",
        extracted: extractedSet,
        catalog: catalogSet,
        status: "conflict",
        weight: -28,
        reason: "Set name conflicts with catalog.",
      });
      conflicts.push("set conflict");
    }
  }
  const hitHead = cardNumberHead(hit.number);
  if (frac) {
    if (hitHead === frac.num.toLowerCase()) {
      score += pushEvidence(evidence, {
        field: "collector number",
        extracted: frac.num,
        catalog: hit.number ?? null,
        status: "match",
        weight: 22,
        reason: "Collector number numerator matches.",
      });
      reasons.push("number");
    } else {
      score += pushEvidence(evidence, {
        field: "collector number",
        extracted: frac.num,
        catalog: hit.number ?? null,
        status: "conflict",
        weight: -32,
        reason: "Collector number numerator conflicts.",
      });
      conflicts.push("number conflict");
    }

    if (catalogHitMatchesPrintedTotal(hit, frac.den)) {
      score += pushEvidence(evidence, {
        field: "set total",
        extracted: String(frac.den),
        catalog: String(hit.set?.printedTotal ?? hit.set?.total ?? ""),
        status: "match",
        weight: 30,
        reason: "Printed denominator agrees with official set total.",
      });
      reasons.push("denominator");
    } else {
      score += pushEvidence(evidence, {
        field: "set total",
        extracted: String(frac.den),
        catalog: String(hit.set?.printedTotal ?? hit.set?.total ?? ""),
        status: "conflict",
        weight: -45,
        reason: "Printed denominator conflicts with official set total.",
      });
      conflicts.push("denominator conflict");
    }
  } else if (
    scoringCard.number?.trim() &&
    looksLikeCollectorNumber(scoringCard.number)
  ) {
    const extractedExact = exactCatalogNumber(scoringCard.number);
    const catalogExact = exactCatalogNumber(hit.number);
    const extractedHead = cardNumberHead(scoringCard.number);
    if (extractedExact && catalogExact && extractedExact === catalogExact) {
      score += pushEvidence(evidence, {
        field: "collector number",
        extracted: scoringCard.number,
        catalog: hit.number ?? null,
        status: "match",
        weight: 28,
        reason: "Collector number exactly matches.",
      });
      reasons.push("number");
    } else if (extractedHead && hitHead && extractedHead === hitHead) {
      score += pushEvidence(evidence, {
        field: "collector number",
        extracted: scoringCard.number,
        catalog: hit.number ?? null,
        status: "match",
        weight: 18,
        reason: "Collector number head matches.",
      });
      reasons.push("number head");
    } else {
      score += pushEvidence(evidence, {
        field: "collector number",
        extracted: scoringCard.number,
        catalog: hit.number ?? null,
        status: "conflict",
        weight: -24,
        reason: "Collector number conflicts.",
      });
      conflicts.push("number conflict");
    }
  }

  const extractedYear = scoringCard.year?.trim();
  const year = candidateYear(hit);
  if (extractedYear && year) {
    if (extractedYear === year) {
      score += pushEvidence(evidence, {
        field: "year",
        extracted: extractedYear,
        catalog: year,
        status: "match",
        weight: 8,
        reason: "Year agrees with catalog release year.",
      });
      reasons.push("year");
    } else {
      score += pushEvidence(evidence, {
        field: "year",
        extracted: extractedYear,
        catalog: year,
        status: "conflict",
        weight: -10,
        reason: "Year conflicts with catalog release year.",
      });
      conflicts.push("year conflict");
    }
  }

  const edition = resolvePrintEdition(scoringCard);
  if (edition && edition.id !== "unknown") {
    score += pushEvidence(evidence, {
      field: "print edition",
      extracted: scoringCard.printStamps ?? edition.label,
      catalog: "Official API spine (name/set/number); edition from vision printStamps",
      status: "match",
      weight: 14,
      reason: `Print run locked to ${edition.label} for comps and FMV.`,
    });
    reasons.push(`edition:${edition.id}`);
  } else if (scoringCard.printStamps?.trim()) {
    score += pushEvidence(evidence, {
      field: "print edition",
      extracted: scoringCard.printStamps,
      catalog: null,
      status: "info",
      weight: 4,
      reason: "Print stamps present but edition not fully resolved.",
    });
  }

  const slabTrusted =
    hasReadableCertNumber(scoringCard.cert) &&
    (scoringCard.encapsulation === "graded_slab" ||
      scoringCard.visionLane === "graded");
  if (slabTrusted) {
    const nameOk = evidence.some((e) => e.field === "name" && e.status === "match");
    const numOk = evidence.some((e) => e.field === "collector number" && e.status === "match");
    if (nameOk && numOk) {
      score += pushEvidence(evidence, {
        field: "slab label",
        extracted: [scoringCard.grader, scoringCard.cert].filter(Boolean).join(" "),
        catalog: "Graded label identity agrees with catalog",
        status: "match",
        weight: 14,
        reason: "Slab cert present with matching name and collector number.",
      });
      reasons.push("slab label");
    }
  }

  const extractedRarity = scoringCard.rarity?.trim();
  if (extractedRarity && hit.rarity) {
    if (
      normalizeIdentityText(extractedRarity) ===
      normalizeIdentityText(hit.rarity)
    ) {
      score += pushEvidence(evidence, {
        field: "rarity",
        extracted: extractedRarity,
        catalog: hit.rarity,
        status: "match",
        weight: 5,
        reason: "Rarity agrees with catalog.",
      });
      reasons.push("rarity");
    }
  }

  const small = hit.images?.small ?? null;
  const large = hit.images?.large ?? null;
  const finalScore = clampScore(score);
  return {
    catalogId: hit.id,
    name: hit.name,
    setName: hit.set?.name ?? null,
    cardNumber: hit.number ?? null,
    year,
    rarity: hit.rarity ?? null,
    score: finalScore,
    confidence: finalScore / 100,
    reasons,
    conflicts,
    imageSmallUrl: small,
    imageLargeUrl: large,
    card: hit,
    evidence,
  };
}

function topHasCollectorNumberMatch(top: ScoredCatalogCandidate): boolean {
  return top.evidence.some(
    (row) => row.field === "collector number" && row.status === "match",
  );
}

function extractedExpectsCollectorNumber(card?: ExtractedCard): boolean {
  if (!card?.number?.trim()) return false;
  return (
    parseCollectorFraction(card.number) != null ||
    looksLikeCollectorNumber(card.number)
  );
}

function resolveCatalogIdentityStatus(
  scored: ScoredCatalogCandidate[],
  card?: ExtractedCard,
): CatalogIdentityStatus {
  if (scored.length === 0) return "failed";
  const [top, runnerUp] = scored;
  const gap = top.score - (runnerUp?.score ?? 0);
  const slabTrusted =
    hasReadableCertNumber(card?.cert) &&
    (card?.encapsulation === "graded_slab" || card?.visionLane === "graded");
  const expectsNumber = extractedExpectsCollectorNumber(card);
  const numberOk = topHasCollectorNumberMatch(top);
  const nameConflict = top.conflicts.includes("name conflict");

  const canConfirm = (scoreFloor: number, gapFloor: number) => {
    if (nameConflict) return false;
    if (top.score < scoreFloor || gap < gapFloor) return false;
    if (expectsNumber && !numberOk) return false;
    return true;
  };

  if (canConfirm(85, 12)) return "confirmed";
  if (top.score >= 85 && scored.length === 1 && !nameConflict) {
    if (!expectsNumber || numberOk) return "confirmed";
  }
  if (numberOk && !nameConflict && canConfirm(80, 8)) return "confirmed";
  if (
    top.reasons.includes("denominator") &&
    numberOk &&
    !nameConflict &&
    top.score >= 78 &&
    gap >= 8
  ) {
    return "confirmed";
  }
  if (
    slabTrusted &&
    top.score >= 82 &&
    gap >= 8 &&
    top.reasons.includes("slab label") &&
    !nameConflict &&
    (!expectsNumber || numberOk)
  ) {
    return "confirmed";
  }
  if (top.score >= 75 && gap >= 10) return "likely";
  if (top.score >= 55) return "ambiguous";
  return "failed";
}

function buildCatalogQueries(
  card: ExtractedCard,
  aliases: TcgDexAlias[] = [],
): string[] {
  const promoNorm = normalizePromoCardIdentity({
    set: card.set,
    number: card.number,
  });
  const searchCard: ExtractedCard = {
    ...card,
    set: canonicalPromoSetName(promoNorm.set) ?? promoNorm.set ?? card.set,
    number: promoNorm.number ?? card.number,
  };

  const name = (searchCard.name?.trim() || searchCard.printedName?.trim() || "").trim();
  if (!name) return [];
  const strict: string[] = [];
  const broad: string[] = [];
  const frac = parseCollectorFraction(searchCard.number);
  const setName = searchCard.set?.trim();
  const number = searchCard.number?.trim();
  const promoSet =
    resolvePokemonPromoSet(setName) ?? resolvePokemonPromoSet(promoNorm.set);

  if (promoSet && number) {
    strict.push(
      `set.id:${promoSet.setId} name:"${escapeQueryValue(name)}" number:"${escapeQueryValue(number)}"`,
    );
  }
  if (promoSet && frac) {
    strict.push(
      `set.id:${promoSet.setId} name:"${escapeQueryValue(name)}" number:"${escapeQueryValue(frac.num)}"`,
    );
  }
  if (setName && number && !isEditionOnlySetName(setName)) {
    strict.push(
      `name:"${escapeQueryValue(name)}" set.name:"${escapeQueryValue(setName)}" number:"${escapeQueryValue(number)}"`,
    );
  }
  for (const alias of aliases) {
    strict.push(`id:${alias.tcgdexId}`);
    if (alias.englishNumber) {
      strict.push(
        `name:"${escapeQueryValue(alias.englishName)}" number:"${escapeQueryValue(alias.englishNumber)}"`,
      );
    }
    if (alias.englishSetName && alias.englishNumber) {
      strict.push(
        `name:"${escapeQueryValue(alias.englishName)}" set.name:"${escapeQueryValue(alias.englishSetName)}" number:"${escapeQueryValue(alias.englishNumber)}"`,
      );
    }
    broad.push(`name:"${escapeQueryValue(alias.englishName)}"`);
    if (alias.englishSetName) {
      broad.push(
        `name:"${escapeQueryValue(alias.englishName)}" set.name:"${escapeQueryValue(alias.englishSetName)}"`,
      );
    }
  }

  if (frac) {
    strict.push(
      `name:"${escapeQueryValue(name)}" number:"${escapeQueryValue(frac.num)}"`,
    );
    broad.unshift(
      `name:"${escapeQueryValue(name)}" number:"${escapeQueryValue(frac.num)}"`,
    );
  } else if (number && looksLikeCollectorNumber(number)) {
    const head = number.split("/")[0]?.trim();
    if (head) {
      broad.push(
        `name:"${escapeQueryValue(name)}" number:"${escapeQueryValue(head)}"`,
      );
    }
  }
  if (promoSet) {
    broad.push(`set.id:${promoSet.setId} name:"${escapeQueryValue(name)}"`);
  }
  if (setName && !isEditionOnlySetName(setName)) {
    broad.push(
      `name:"${escapeQueryValue(name)}" set.name:"${escapeQueryValue(setName)}"`,
    );
  }
  broad.push(`name:"${escapeQueryValue(name)}"`);
  return Array.from(new Set([...strict, ...broad])).slice(0, MAX_LIVE_CATALOG_QUERIES);
}

const LIVE_CATALOG_PAGE_SIZE = 28;
const MAX_LIVE_CATALOG_QUERIES = 6;
const DEEP_CATALOG_PAGE_SIZE = 50;
const DEEP_CATALOG_MAX_QUERIES = 8;
const DEEP_CATALOG_MIN_HITS = 24;
export const MAX_CATALOG_CANDIDATE_ROWS = 16;

type CollectCatalogHitsOptions = {
  /** Run more API queries and keep a wider hit pool for manual pick lists. */
  deep?: boolean;
};

function needsTcgDexAliasLookup(card: ExtractedCard): boolean {
  const lang = (card.language ?? "").trim();
  if (lang && !/^english?$/i.test(lang)) return true;
  const printed = card.printedName?.trim();
  const name = card.name?.trim();
  return Boolean(printed && name && printed.toLowerCase() !== name.toLowerCase());
}

async function collectCatalogHits(
  cardForSearch: ExtractedCard,
  aliases: TcgDexAlias[],
  options?: CollectCatalogHitsOptions,
): Promise<PokemonTcgCard[]> {
  const deep = options?.deep === true;
  const maxQueries = deep ? DEEP_CATALOG_MAX_QUERIES : MAX_LIVE_CATALOG_QUERIES;
  const pageSize = deep ? DEEP_CATALOG_PAGE_SIZE : LIVE_CATALOG_PAGE_SIZE;
  const minHitsBeforeStop = deep ? DEEP_CATALOG_MIN_HITS : 8;

  const queries = buildCatalogQueries(cardForSearch, aliases).slice(0, maxQueries);
  const seen = new Set<string>();
  const hits: PokemonTcgCard[] = [];

  for (const query of queries) {
    const batch = await fetchCatalogCards(query, pageSize, {
      orderByNumber: /\bnumber:/.test(query),
    });
    for (const hit of batch) {
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      hits.push(hit);
    }
    if (hits.length >= minHitsBeforeStop) {
      const scored = hits
        .map((hit) => scoreCatalogCandidate(cardForSearch, hit, aliases))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_CATALOG_CANDIDATE_ROWS);
      const status = resolveCatalogIdentityStatus(scored, cardForSearch);
      const top = scored[0];
      if (!deep && status === "confirmed" && top && top.score >= 85) break;
      if (deep && status === "confirmed" && top && top.score >= 92 && scored.length >= 6) {
        break;
      }
    }
  }

  return hits;
}

function buildCatalogMatchFromHits(
  cardForSearch: ExtractedCard,
  card: ExtractedCard,
  hits: PokemonTcgCard[],
  aliases: TcgDexAlias[],
): CatalogMatch | null {
  if (hits.length === 0) return null;

  const scored = hits
    .map((hit) => scoreCatalogCandidate(cardForSearch, hit, aliases))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, MAX_CATALOG_CANDIDATE_ROWS);
  const top = scored[0];
  if (!top) return null;

  const status = resolveCatalogIdentityStatus(scored, cardForSearch);
  const frac = parseCollectorFraction(card.number);
  const matchBasis: CatalogMatch["matchBasis"] =
    status === "confirmed" && frac
      ? "fraction_total"
      : status === "confirmed"
        ? "strict"
        : "loose";
  const candidates = scored.map((row) => {
    const { card: hit, evidence, ...candidate } = row;
    void hit;
    void evidence;
    return candidate;
  });

  return toCatalogMatch(top.card, matchBasis, {
    status,
    score: top.score,
    confidence: top.confidence,
    candidates,
    evidence: top.evidence,
  });
}

/** Wide master-catalog search for manual pick UI (Pokédex-aligned API). */
export async function suggestPokemonCatalogCandidates(
  card: ExtractedCard,
): Promise<CatalogMatch | null> {
  if (!inferCardFranchise(card).isPokemon) return null;
  const searchName = effectiveCatalogSearchName(card);
  if (!searchName) return null;

  const promoNorm = normalizePromoCardIdentity({ set: card.set, number: card.number });
  const cardForSearch = {
    ...card,
    name: searchName,
    set: canonicalPromoSetName(promoNorm.set) ?? promoNorm.set ?? card.set,
    number: promoNorm.number ?? card.number,
  };
  const aliases = needsTcgDexAliasLookup(card)
    ? await resolveTcgDexAliases(card)
    : [];
  const hits = await collectCatalogHits(cardForSearch, aliases, { deep: true });
  return buildCatalogMatchFromHits(cardForSearch, card, hits, aliases);
}

export async function matchPokemonCatalog(
  card: ExtractedCard,
): Promise<CatalogMatch | null> {
  if (!inferCardFranchise(card).isPokemon) return null;
  const searchName = effectiveCatalogSearchName(card);
  if (!searchName) return null;

  const promoNorm = normalizePromoCardIdentity({ set: card.set, number: card.number });
  const cardForSearch = {
    ...card,
    name: searchName,
    set: canonicalPromoSetName(promoNorm.set) ?? promoNorm.set ?? card.set,
    number: promoNorm.number ?? card.number,
  };
  const aliases = needsTcgDexAliasLookup(card)
    ? await resolveTcgDexAliases(card)
    : [];
  const hits = await collectCatalogHits(cardForSearch, aliases);
  return buildCatalogMatchFromHits(cardForSearch, card, hits, aliases);
}
