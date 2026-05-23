import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { searchWeb } from "@/lib/market/web-search";
import { effectiveCatalogSearchName } from "@/lib/scan/card-display";
import { franchiseSearchPrefix, inferCardFranchise } from "@/lib/scan/franchise";
import type { CatalogCandidate, ExtractedCard, IdentityEvidence } from "@/lib/scan/schemas";

function compact(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.-]/g, "")
    .replace(/\s+/g, " ");
}

function candidateId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  }
  return `web-${hash.toString(16)}`;
}

function parseYear(text: string): string | null {
  const match = text.match(/\b(19[5-9]\d|20\d{2})\b/);
  return match?.[1] ?? null;
}

function parseNumber(text: string): string | null {
  const match =
    text.match(/\b(?:card\s*)?(?:#|no\.?\s*)?([A-Z]{0,5}\d{1,4}[a-z]?(?:\s*\/\s*\d{1,4})?)\b/i) ??
    text.match(/\b(OP|EB|ST|FB|BT|BSS|EX|SP|PR|P|S)[-\s]?\d{2,4}\b/i);
  return match?.[1]?.replace(/\s+/g, "") ?? null;
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
}

function scoreCandidate(card: ExtractedCard, title: string, snippet: string): number {
  const h = normalize(`${title} ${snippet}`);
  const name = normalize(effectiveCatalogSearchName(card));
  const set = normalize(card.set);
  const num = normalize(card.number);
  const franchise = normalize(franchiseSearchPrefix(card));
  let score = 18;
  if (franchise && h.includes(franchise)) score += 18;
  if (name && h.includes(name)) score += 35;
  else if (name && name.split(" ").some((part) => part.length > 3 && h.includes(part))) score += 18;
  if (set && h.includes(set)) score += 18;
  if (num && h.replace(/\s+/g, "").includes(num.replace(/\s+/g, ""))) score += 16;
  if (/tcgplayer|pricecharting|cardmarket|psacard|beckett|sportscardpro|130point/i.test(h)) score += 8;
  if (/sealed|booster box|pack\b|sleeves|playmat/i.test(h)) score -= 12;
  return Math.max(0, Math.min(100, score));
}

function buildSearchQueries(card: ExtractedCard): string[] {
  const profile = inferCardFranchise(card);
  const identity = compact([
    franchiseSearchPrefix(card),
    effectiveCatalogSearchName(card),
    card.set,
    card.number,
    card.year,
    card.rarity,
    card.printStamps,
  ]);
  const sourceSites = profile.isTcg
    ? "site:tcgplayer.com OR site:cardmarket.com OR site:pricecharting.com"
    : "site:pricecharting.com OR site:psacard.com OR site:sportscardpro.com";
  return [
    compact([identity, "card checklist"]),
    compact([identity, "trading card catalog"]),
    compact([sourceSites, identity]),
  ].filter(Boolean);
}

export async function matchGenericCatalog(card: ExtractedCard): Promise<CatalogMatch | null> {
  const searchName = effectiveCatalogSearchName(card);
  if (!searchName) return null;
  const queries = buildSearchQueries(card);
  const settled = await Promise.allSettled(queries.map((query) => searchWeb(query, 5)));
  const candidates: CatalogCandidate[] = [];
  const seen = new Set<string>();

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const row of result.value) {
      if (seen.has(row.url)) continue;
      seen.add(row.url);
      const text = `${row.title} ${row.snippet}`;
      const score = scoreCandidate(card, row.title, row.snippet);
      if (score < 35) continue;
      const reasons = [`source: ${hostLabel(row.url)}`];
      if (normalize(row.title).includes(normalize(searchName))) reasons.push("name");
      const number = parseNumber(text) ?? card.number ?? null;
      if (number && card.number && normalize(number) === normalize(card.number)) reasons.push("number");
      const year = parseYear(text) ?? card.year ?? null;
      candidates.push({
        catalogId: candidateId(row.url),
        name: searchName,
        setName: card.set ?? null,
        cardNumber: number,
        year,
        rarity: card.rarity ?? null,
        score,
        confidence: score / 100,
        reasons,
        conflicts: [],
        imageSmallUrl: null,
        imageLargeUrl: null,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  if (!top) return null;
  const runnerUp = candidates[1];
  const gap = top.score - (runnerUp?.score ?? 0);
  const status = top.score >= 78 && gap >= 12 ? "likely" : top.score >= 55 ? "ambiguous" : "failed";
  const evidence: IdentityEvidence[] = [
    {
      field: "franchise",
      extracted: card.franchise ?? null,
      catalog: franchiseSearchPrefix(card),
      status: "info",
      weight: 8,
      reason: "Web catalog fallback when no dedicated franchise API match was confirmed.",
    },
    {
      field: "web candidates",
      extracted: compact([card.name, card.set, card.number]),
      catalog: top.reasons.join(" / "),
      status: status === "failed" ? "missing" : "info",
      weight: top.score,
      reason: "Web-backed catalog sources produced a ranked identity candidate.",
    },
  ];

  return {
    catalogId: top.catalogId,
    name: top.name,
    setName: top.setName,
    cardNumber: top.cardNumber,
    year: top.year,
    rarity: top.rarity,
    imageSmallUrl: null,
    imageLargeUrl: null,
    imageUrl: null,
    prices: {
      tcgPlayerUrl: null,
      tcgPlayerUpdatedAt: null,
      tcgPlayerPrices: [],
      cardMarketUrl: null,
      cardMarketUpdatedAt: null,
      cardMarket: null,
    },
    matchBasis: "loose",
    catalogIdentityStatus: status,
    catalogConfidence: top.confidence,
    score: top.score,
    candidates: candidates.slice(0, 8),
    identityEvidence: evidence,
  };
}

