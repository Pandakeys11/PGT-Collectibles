import { getApifyApiToken } from "@/lib/market/apify-psa-pop";
import {
  isApifyEbaySoldBlocked,
  markApifyEbaySoldBlocked,
  parseApifyEbaySoldBlockFromBody,
} from "@/lib/market/provider-health";
import { enrichEbaySoldEvidence } from "@/lib/market/ebay-evidence-enrich";
import { filterEbaySoldForCard } from "@/lib/market/ebay-evidence-match";
import {
  cleanEbaySoldQuery,
  ebaySearchCategoryIdForCard,
  ebaySoldQueryCandidates,
} from "@/lib/market/ebay-sold-common";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

const DEFAULT_ACTOR_SLUG = "caffein.dev/ebay-sold-listings";

function apifyEbayDebugLog(message: string, detail?: unknown): void {
  if (process.env.APIFY_EBAY_DEBUG !== "1") return;
  console.warn(`[apify-ebay-sold] ${message}`, detail ?? "");
}

export function getApifyEbaySoldActorSlug(): string {
  const raw = process.env.APIFY_EBAY_SOLD_ACTOR?.trim();
  if (!raw || /^(your_|replace|paste|<)/i.test(raw)) return DEFAULT_ACTOR_SLUG;
  return raw;
}

/** Token present (may still be quota-blocked at runtime). */
export function hasApifyEbaySoldCredentials(): boolean {
  if (process.env.EBAY_SOLD_APIFY === "0") return false;
  return Boolean(getApifyApiToken());
}

/** Apify eBay sold actor operational for this process. Set `EBAY_SOLD_APIFY=0` to skip. */
export function isApifyEbaySoldConfigured(): boolean {
  return hasApifyEbaySoldCredentials() && !isApifyEbaySoldBlocked();
}

function inferSlabFromTitle(title: string): string | null {
  const hay = title.toLowerCase();
  if (/black\s*label|bgs.*black/.test(hay)) return "BGS Black Label";
  if (/psa\s*10|gem\s*mint\s*10/.test(hay)) return "PSA 10";
  if (/cgc/.test(hay) && (/pristine/i.test(hay) || /cgc\s*10(\.0)?\b/.test(hay))) {
    return /pristine/i.test(hay) ? "CGC Pristine 10" : "CGC 10";
  }
  if (/psa\s*9\b|cgc\s*9\b|bgs\s*9\b/.test(hay)) return "PSA 9";
  return null;
}

function parseSoldPriceUsd(row: Record<string, unknown>): number | null {
  const candidates = [row.totalPrice, row.soldPrice, row.price, row.finalPrice];
  for (const raw of candidates) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw < 250_000) {
      return raw;
    }
    if (typeof raw === "string" && raw.trim()) {
      const n = Number.parseFloat(raw.replace(/,/g, "").replace(/[^\d.]/g, ""));
      if (Number.isFinite(n) && n >= 1 && n < 250_000) return n;
    }
  }
  return null;
}

function parseEndedAtIso(row: Record<string, unknown>): string | null {
  const raw =
    (typeof row.endedAt === "string" && row.endedAt) ||
    (typeof row.endDate === "string" && row.endDate) ||
    (typeof row.soldDate === "string" && row.soldDate) ||
    null;
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function apifyRowToEvidence(row: Record<string, unknown>): MarketEvidence | null {
  const title =
    (typeof row.title === "string" && row.title.trim()) ||
    (typeof row.name === "string" && row.name.trim()) ||
    "";
  const url =
    (typeof row.url === "string" && row.url.startsWith("http") && row.url) ||
    (typeof row.itemUrl === "string" && row.itemUrl.startsWith("http") && row.itemUrl) ||
    (typeof row.itemId === "string" || typeof row.itemId === "number"
      ? `https://www.ebay.com/itm/${String(row.itemId).replace(/\D/g, "")}`
      : null);
  if (!title || !url) return null;

  const priceUsd = parseSoldPriceUsd(row);
  if (priceUsd == null) return null;

  return enrichEbaySoldEvidence({
    kind: "sold",
    title: title.slice(0, 240),
    priceUsd,
    observedAt: parseEndedAtIso(row),
    url,
    source: "eBay",
    slab: inferSlabFromTitle(title),
    confidence: 0.88,
    saleType: "auction",
  });
}

function dedupeSold(items: MarketEvidence[]): MarketEvidence[] {
  const seen = new Set<string>();
  const out: MarketEvidence[] = [];
  for (const it of items) {
    const key = `${it.url ?? ""}|${it.title}|${it.priceUsd ?? ""}|${it.observedAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

async function fetchApifyEbaySoldForKeyword(
  card: ExtractedCard,
  keyword: string,
): Promise<MarketEvidence[]> {
  if (!isApifyEbaySoldConfigured()) return [];
  const token = getApifyApiToken();
  if (!token) return [];

  const query = cleanEbaySoldQuery(keyword);
  if (query.length < 3) return [];

  const categoryId = ebaySearchCategoryIdForCard(card);
  const count = Math.min(Math.max(Number(process.env.APIFY_EBAY_SOLD_COUNT ?? 40) || 40, 8), 100);
  const daysToScrape = Math.min(Math.max(Number(process.env.APIFY_EBAY_SOLD_DAYS ?? 90) || 90, 7), 120);

  const input: Record<string, unknown> = {
    keywords: [query],
    daysToScrape,
    count,
    ebaySite: process.env.APIFY_EBAY_SOLD_SITE?.trim() || "ebay.com",
    sortOrder: "endedRecently",
    itemCondition: "any",
    itemLocation: "default",
  };
  if (categoryId) {
    input.subcategoryId = categoryId;
  }

  const actorSlug = getApifyEbaySoldActorSlug();
  const actorId = actorSlug.replace("/", "~");
  const timeoutSec = Math.min(
    Math.max(Number(process.env.APIFY_EBAY_SOLD_TIMEOUT_SEC ?? 90) || 90, 30),
    300,
  );
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=${timeoutSec}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
    cache: "no-store",
    signal: AbortSignal.timeout((timeoutSec + 20) * 1000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    apifyEbayDebugLog(`HTTP ${res.status} keyword=${query}`, errText.slice(0, 400));
    const blockReason = parseApifyEbaySoldBlockFromBody(res.status, errText);
    if (blockReason) markApifyEbaySoldBlocked(blockReason);
    return [];
  }

  const items = (await res.json()) as unknown;
  if (!Array.isArray(items) || items.length === 0) {
    apifyEbayDebugLog(`empty dataset keyword=${query}`);
    return [];
  }

  const evidence: MarketEvidence[] = [];
  for (const row of items) {
    if (!row || typeof row !== "object") continue;
    const ev = apifyRowToEvidence(row as Record<string, unknown>);
    if (ev) evidence.push(ev);
  }
  return evidence;
}

/**
 * Runs Apify eBay sold listings actor for primary + fallback keyword variants.
 */
export async function fetchApifyEbaySoldForCard(card: ExtractedCard): Promise<MarketEvidence[]> {
  if (!isApifyEbaySoldConfigured()) return [];

  const candidates = ebaySoldQueryCandidates(card).slice(0, 4);
  const merged: MarketEvidence[] = [];

  for (const keyword of candidates) {
    try {
      const rows = await fetchApifyEbaySoldForKeyword(card, keyword);
      if (rows.length) merged.push(...rows);
      const filtered = filterEbaySoldForCard(card, dedupeSold(merged));
      if (filtered.filter((r) => r.kind === "sold").length >= 8) break;
    } catch (err) {
      apifyEbayDebugLog(
        `request failed keyword=${keyword}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return filterEbaySoldForCard(card, dedupeSold(merged));
}
