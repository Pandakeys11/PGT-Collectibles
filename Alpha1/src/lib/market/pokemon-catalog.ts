import type {
  CatalogCandidate,
  CatalogIdentityStatus,
  ExtractedCard,
  IdentityEvidence,
} from "@/lib/scan/schemas";
import { parseCollectorFraction } from "@/lib/scan/collector-fraction";
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
  apiKey: string | undefined,
  pageSize: number,
): Promise<PokemonTcgCard[]> {
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=${pageSize}`;
  const headers: HeadersInit = { Accept: "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;

  try {
    const response = await fetch(url, {
      headers,
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: PokemonTcgCard[] };
    return payload.data ?? [];
  } catch {
    return [];
  }
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

  const extractedSet = scoringCard.set?.trim() ?? "";
  const catalogSet = hit.set?.name ?? null;
  if (extractedSet && !isEditionOnlySetName(extractedSet)) {
    if (setNamesMatch(catalogSet ?? undefined, extractedSet)) {
      score += pushEvidence(evidence, {
        field: "set",
        extracted: extractedSet,
        catalog: catalogSet,
        status: "match",
        weight: 18,
        reason: "Set name agrees with catalog.",
      });
      reasons.push("set");
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

  const frac = parseCollectorFraction(scoringCard.number);
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

function resolveCatalogIdentityStatus(
  scored: ScoredCatalogCandidate[],
): CatalogIdentityStatus {
  if (scored.length === 0) return "failed";
  const [top, runnerUp] = scored;
  const gap = top.score - (runnerUp?.score ?? 0);
  if (top.score >= 90 && gap >= 15) return "confirmed";
  if (top.score >= 85 && scored.length === 1) return "confirmed";
  if (top.score >= 75 && gap >= 10) return "likely";
  if (top.score >= 55) return "ambiguous";
  return "failed";
}

function dedupeCatalogHits(hits: PokemonTcgCard[]): PokemonTcgCard[] {
  const seen = new Set<string>();
  const unique: PokemonTcgCard[] = [];
  for (const hit of hits) {
    if (seen.has(hit.id)) continue;
    seen.add(hit.id);
    unique.push(hit);
  }
  return unique;
}

function buildCatalogQueries(
  card: ExtractedCard,
  aliases: TcgDexAlias[] = [],
): string[] {
  const name = (card.name?.trim() || card.printedName?.trim() || "").trim();
  if (!name) return [];
  const queries: string[] = [];
  const frac = parseCollectorFraction(card.number);
  const setName = card.set?.trim();
  const number = card.number?.trim();
  for (const alias of aliases) {
    queries.push(`id:${alias.tcgdexId}`);
    queries.push(`name:"${escapeQueryValue(alias.englishName)}"`);
    if (alias.englishNumber) {
      queries.push(
        `name:"${escapeQueryValue(alias.englishName)}" number:"${escapeQueryValue(alias.englishNumber)}"`,
      );
    }
    if (alias.englishSetName) {
      queries.push(
        `name:"${escapeQueryValue(alias.englishName)}" set.name:"${escapeQueryValue(alias.englishSetName)}"`,
      );
    }
  }

  if (frac) {
    queries.push(
      `name:"${escapeQueryValue(name)}" number:"${escapeQueryValue(frac.num)}"`,
    );
  }
  if (number && looksLikeCollectorNumber(number)) {
    const head = number.split("/")[0]?.trim();
    if (head)
      queries.push(
        `name:"${escapeQueryValue(name)}" number:"${escapeQueryValue(head)}"`,
      );
  }
  if (setName && !isEditionOnlySetName(setName)) {
    queries.push(
      `name:"${escapeQueryValue(name)}" set.name:"${escapeQueryValue(setName)}"`,
    );
  }
  queries.push(`name:"${escapeQueryValue(name)}"`);
  return Array.from(new Set(queries));
}

export async function matchPokemonCatalog(
  card: ExtractedCard,
): Promise<CatalogMatch | null> {
  const searchName = effectiveCatalogSearchName(card);
  if (!searchName) return null;

  const cardForSearch = { ...card, name: searchName };
  const apiKey = process.env.POKEMON_TCG_API_KEY?.trim();
  const aliases = await resolveTcgDexAliases(card);
  const hits = dedupeCatalogHits(
    (
      await Promise.all(
        buildCatalogQueries(cardForSearch, aliases).map((query) =>
          fetchCatalogCards(query, apiKey, 60),
        ),
      )
    ).flat(),
  );
  if (hits.length === 0) return null;

  const scored = hits
    .map((hit) => scoreCatalogCandidate(cardForSearch, hit, aliases))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 8);
  const top = scored[0];
  if (!top) return null;

  const status = resolveCatalogIdentityStatus(scored);
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
