import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import type {
  CatalogCandidate,
  CatalogIdentityStatus,
  ExtractedCard,
  IdentityEvidence,
} from "@/lib/scan/schemas";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";

export type ScoredCatalogRow = {
  catalogId: string;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  year: string | null;
  rarity: string | null;
  score: number;
  confidence: number;
  reasons: string[];
  conflicts: string[];
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  prices?: CatalogPriceSnapshot;
};

const EMPTY_PRICES: CatalogPriceSnapshot = {
  tcgPlayerUrl: null,
  tcgPlayerUpdatedAt: null,
  tcgPlayerPrices: [],
  cardMarketUrl: null,
  cardMarketUpdatedAt: null,
  cardMarket: null,
};

export function normalizeCatalogToken(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.-]/g, "")
    .replace(/\s+/g, " ");
}

export function buildCatalogSearchText(parts: Array<string | null | undefined>): string {
  return normalizeCatalogToken(parts.filter(Boolean).join(" "));
}

export function resolveCatalogIdentityStatus(
  scored: Array<{ score: number }>,
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

export function scoreNameSetNumber(
  card: ExtractedCard,
  hit: { name: string; setName?: string | null; cardNumber?: string | null; year?: string | null },
  options?: { franchiseHint?: string },
): { score: number; reasons: string[]; conflicts: string[] } {
  const reasons: string[] = [];
  const conflicts: string[] = [];
  let score = 20;
  const name = normalizeCatalogToken(card.name ?? card.printedName);
  const hitName = normalizeCatalogToken(hit.name);
  const set = normalizeCatalogToken(card.set);
  const hitSet = normalizeCatalogToken(hit.setName);
  const num = normalizeCatalogToken(card.number)?.replace(/\s+/g, "");
  const hitNum = normalizeCatalogToken(hit.cardNumber)?.replace(/\s+/g, "");

  if (options?.franchiseHint) {
    score += 8;
    reasons.push("franchise");
  }
  if (name && hitName) {
    if (name === hitName) {
      score += 38;
      reasons.push("name");
    } else if (hitName.includes(name) || name.includes(hitName)) {
      score += 24;
      reasons.push("name_partial");
    } else {
      conflicts.push("name");
    }
  }
  if (set && hitSet) {
    if (set === hitSet || hitSet.includes(set) || set.includes(hitSet)) {
      score += 20;
      reasons.push("set");
    } else {
      conflicts.push("set");
    }
  }
  if (num && hitNum && (num === hitNum || hitNum.includes(num) || num.includes(hitNum))) {
    score += 18;
    reasons.push("number");
  } else if (num && hitNum) {
    conflicts.push("number");
  }
  if (card.year && hit.year && card.year === hit.year) {
    score += 6;
    reasons.push("year");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons, conflicts };
}

export function rowsToCandidates(rows: ScoredCatalogRow[]): CatalogCandidate[] {
  return rows.map((row) => ({
    catalogId: row.catalogId,
    name: row.name,
    setName: row.setName,
    cardNumber: row.cardNumber,
    year: row.year,
    rarity: row.rarity,
    score: row.score,
    confidence: row.confidence,
    reasons: row.reasons,
    conflicts: row.conflicts,
    imageSmallUrl: row.imageSmallUrl,
    imageLargeUrl: row.imageLargeUrl,
  }));
}

export function buildCatalogMatch(
  rows: ScoredCatalogRow[],
  evidence: IdentityEvidence[],
  matchBasis: CatalogMatch["matchBasis"] = "strict",
): CatalogMatch | null {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  if (!top) return null;
  const status = resolveCatalogIdentityStatus(sorted);
  const candidates = rowsToCandidates(sorted.slice(0, 16));
  const tcgUrl = top.prices?.tcgPlayerUrl ?? null;
  return {
    catalogId: top.catalogId,
    name: top.name,
    setName: top.setName,
    cardNumber: top.cardNumber,
    year: top.year,
    rarity: top.rarity,
    imageSmallUrl: top.imageSmallUrl,
    imageLargeUrl: top.imageLargeUrl,
    imageUrl: top.imageLargeUrl ?? top.imageSmallUrl,
    prices: top.prices ?? {
      ...EMPTY_PRICES,
      tcgPlayerUrl: tcgUrl,
    },
    matchBasis,
    catalogIdentityStatus: status,
    catalogConfidence: top.confidence,
    score: top.score,
    candidates,
    identityEvidence: evidence,
  };
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T | null> {
  const timeoutMs = init?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
