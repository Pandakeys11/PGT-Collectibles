import type { MarketApiAdapter, ApiAdapterResult } from "@/lib/market/adapters/types";
import {
  fetchApifyEbaySoldForCard,
  hasApifyEbaySoldCredentials,
  isApifyEbaySoldConfigured,
} from "@/lib/market/apify-ebay-sold";
import {
  brightDataEbayQuotaLabel,
  fetchEbaySoldHtmlViaBrightData,
  isEbaySoldBrightDataEnabled,
  isEbaySoldBrightDataPrimary,
} from "@/lib/market/brightdata/ebay-sold-unlocker";
import { isEbaySoldProductionReady } from "@/lib/market/ebay-sold-readiness";
import { fetchEbayFindingCompletedSold } from "@/lib/market/ebay-finding-completed";
import {
  fetchEbayMarketplaceInsightsSold,
  isEbayMarketplaceInsightsConfigured,
} from "@/lib/market/ebay-marketplace-insights";
import {
  buildEbaySoldCompletedSearchUrl,
  ebaySoldQueryCandidates,
  ebaySearchCategoryIdForCard,
  isLikelyBlockedEbayHtml,
} from "@/lib/market/ebay-sold-common";
import { parseEbaySoldHtmlItems } from "@/lib/market/ebay-sold-html-parse";
import { filterEbaySoldForCard } from "@/lib/market/ebay-evidence-match";
import { getEbayFindingAppId } from "@/lib/market/env-market";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

const EBAY_SOLD_TIMEOUT_MS = 18_000;
const MAX_ITEMS = 14;
const MAX_BRIGHTDATA_QUERIES = 2;

function dedupeSold(items: MarketEvidence[]): MarketEvidence[] {
  const seen = new Set<string>();
  const out: MarketEvidence[] = [];
  for (const it of items) {
    const key = `${it.url ?? ""}|${it.title}|${it.priceUsd ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

async function scrapeEbaySoldHtmlDirect(
  card: ExtractedCard,
  query: string,
): Promise<{ evidence: MarketEvidence[]; blocked: boolean }> {
  const url = buildEbaySoldCompletedSearchUrl(query, {
    ipg: 60,
    categoryId: ebaySearchCategoryIdForCard(card),
  });

  if (isEbaySoldBrightDataPrimary()) {
    const bd = await fetchEbaySoldHtmlViaBrightData(url);
    if (!bd.blocked && bd.html) {
      return { evidence: parseEbaySoldHtmlItems(bd.html), blocked: false };
    }
    return { evidence: [], blocked: bd.blocked };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(EBAY_SOLD_TIMEOUT_MS),
    });
    if (response.ok) {
      const html = await response.text();
      if (html && html.length >= 2000 && !isLikelyBlockedEbayHtml(html)) {
        return { evidence: parseEbaySoldHtmlItems(html), blocked: false };
      }
    }
  } catch {
    /* fall through */
  }

  if (!isEbaySoldBrightDataEnabled()) {
    return { evidence: [], blocked: true };
  }

  const bd = await fetchEbaySoldHtmlViaBrightData(url);
  if (bd.blocked || !bd.html) return { evidence: [], blocked: true };
  return { evidence: parseEbaySoldHtmlItems(bd.html), blocked: false };
}

/**
 * Sold comps pipeline:
 * 1. Bright Data HTML (when primary or Apify unavailable) — budget-capped
 * 2. Apify sold actor
 * 3. Marketplace Insights (when approved)
 * 4. Finding API
 * 5. Direct HTML → Bright Data fallback
 */
async function collectEbaySoldEvidence(card: ExtractedCard): Promise<{ evidence: MarketEvidence[]; warnings: string[] }> {
  const warnings: string[] = [];
  const candidates = ebaySoldQueryCandidates(card);
  if (candidates.length === 0) return { evidence: [], warnings };

  const merged: MarketEvidence[] = [];
  const categoryId = ebaySearchCategoryIdForCard(card);
  const tryBrightDataFirst =
    isEbaySoldBrightDataPrimary() ||
    (isEbaySoldBrightDataEnabled() && !isApifyEbaySoldConfigured());

  if (tryBrightDataFirst) {
    let bdQueries = 0;
    for (const q of candidates) {
      if (bdQueries >= MAX_BRIGHTDATA_QUERIES) break;
      const url = buildEbaySoldCompletedSearchUrl(q, { ipg: 60, categoryId });
      const { html, blocked, fromCache } = await fetchEbaySoldHtmlViaBrightData(url);
      bdQueries += fromCache ? 0 : 1;
      if (!blocked && html) {
        merged.push(...parseEbaySoldHtmlItems(html));
        if (filterEbaySoldForCard(card, dedupeSold(merged)).length >= MAX_ITEMS) break;
      }
    }
    if (merged.length === 0 && isEbaySoldBrightDataEnabled()) {
      warnings.push(`Bright Data eBay unlock returned no sold rows (${brightDataEbayQuotaLabel()}).`);
    }
  }

  let deduped = filterEbaySoldForCard(card, dedupeSold(merged));
  if (deduped.length >= MAX_ITEMS) {
    return { evidence: deduped.slice(0, MAX_ITEMS), warnings };
  }

  if (isApifyEbaySoldConfigured()) {
    const apifyRows = await fetchApifyEbaySoldForCard(card).catch(() => []);
    if (apifyRows.length > 0) merged.push(...apifyRows);
  }

  if (isEbayMarketplaceInsightsConfigured()) {
    const insightsRows = await fetchEbayMarketplaceInsightsSold(card).catch(() => []);
    if (insightsRows.length > 0) merged.push(...insightsRows);
  }

  deduped = filterEbaySoldForCard(card, dedupeSold(merged));
  if (deduped.length >= MAX_ITEMS) {
    return { evidence: deduped.slice(0, MAX_ITEMS), warnings };
  }

  const findingDisabled = process.env.EBAY_DISABLE_FINDING === "1";
  if (!findingDisabled && getEbayFindingAppId()) {
    for (const q of candidates.slice(0, 2)) {
      const finding = await fetchEbayFindingCompletedSold(q, 24, categoryId).catch(() => []);
      merged.push(...finding);
      if (finding.length >= 3) break;
    }
  }

  deduped = filterEbaySoldForCard(card, dedupeSold(merged));
  if (deduped.length >= MAX_ITEMS) {
    return { evidence: deduped.slice(0, MAX_ITEMS), warnings };
  }

  if (!tryBrightDataFirst) {
    let sawBlocked = false;
    for (const q of candidates) {
      const { evidence, blocked } = await scrapeEbaySoldHtmlDirect(card, q);
      if (blocked) sawBlocked = true;
      if (evidence.length > 0) {
        merged.push(...evidence);
        if (dedupeSold(merged).length >= MAX_ITEMS) break;
      }
    }
    if (sawBlocked && merged.length === 0 && isEbaySoldBrightDataEnabled()) {
      warnings.push(
        `eBay HTML blocked; Bright Data had no sold rows (${brightDataEbayQuotaLabel()}).`,
      );
    }
  }

  const evidence = filterEbaySoldForCard(card, dedupeSold(merged)).slice(0, MAX_ITEMS);
  if (evidence.length === 0 && candidates.length > 0) {
    if (!isEbaySoldProductionReady()) {
      warnings.push(
        "eBay sold comps not operational — Apify quota, Finding limits, or Bright Data daily budget (npm run verify:brightdata -- --ebay).",
      );
    } else if (hasApifyEbaySoldCredentials() && !isApifyEbaySoldConfigured()) {
      warnings.push("Apify eBay sold blocked — using Finding/Bright Data only.");
    } else {
      warnings.push("No eBay sold rows matched this card — tighten scan identity.");
    }
  }

  return { evidence, warnings };
}

export const ebaySoldScrapeAdapter: MarketApiAdapter = {
  id: "ebay_sold_scrape",
  async collect(card: ExtractedCard): Promise<ApiAdapterResult> {
    const { evidence, warnings } = await collectEbaySoldEvidence(card);
    return {
      adapter: "ebay_sold_scrape",
      evidence,
      warnings: warnings.length ? warnings : undefined,
    };
  },
};
