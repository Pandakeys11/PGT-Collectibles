import type { MarketApiAdapter, ApiAdapterResult } from "@/lib/market/adapters/types";
import { fetchApifyEbaySoldForCard, isApifyEbaySoldConfigured } from "@/lib/market/apify-ebay-sold";
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
  parseEbayCaptionDateIso,
  parseEbayUsdAverage,
  parseEbayUsdFirst,
} from "@/lib/market/ebay-sold-common";
import { filterEbaySoldForCard } from "@/lib/market/ebay-evidence-match";
import { getEbayFindingAppId } from "@/lib/market/env-market";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

const EBAY_SOLD_TIMEOUT_MS = 18_000;
const MAX_ITEMS = 14;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferSlab(hay: string): string | null {
  if (/bgs.*black\s*label|black\s*label/i.test(hay)) return "BGS Black Label";
  if (/psa\s*10/i.test(hay)) return "PSA 10";
  if (/cgc/i.test(hay) && (/pristine/i.test(hay) || /cgc\s*10(\.0)?\b/i.test(hay))) {
    return /pristine/i.test(hay) ? "CGC Pristine 10" : "CGC 10";
  }
  if (/psa\s*9\b|cgc\s*9\b|bgs\s*9\b/i.test(hay)) return "PSA 9";
  return null;
}

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

async function scrapeEbaySoldHtml(
  card: ExtractedCard,
  query: string,
): Promise<{ evidence: MarketEvidence[]; blocked: boolean }> {
  const url = buildEbaySoldCompletedSearchUrl(query, {
    ipg: 60,
    categoryId: ebaySearchCategoryIdForCard(card),
  });
  let html = "";
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
    if (!response.ok) return { evidence: [], blocked: false };
    html = await response.text();
  } catch {
    return { evidence: [], blocked: false };
  }

  if (!html || isLikelyBlockedEbayHtml(html)) return { evidence: [], blocked: true };

  const itemPattern = /<li[^>]*(?:class="[^"]*\bs-item\b[^"]*"|class='[^']*\bs-item[^']*')[^>]*>([\s\S]*?)<\/li>/gi;
  const evidence: MarketEvidence[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) && evidence.length < MAX_ITEMS) {
    const block = match[1];
    if (!block.includes("s-item__link")) continue;

    let title = "";
    const heading = block.match(
      /class="[^"]*s-item__title[^"]*"[^>]*>[\s\S]*?<span[^>]*role=['"]heading['"][^>]*>([\s\S]*?)<\/span>/i,
    );
    const titleDiv = block.match(/<div[^>]+class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (heading?.[1]) title = decodeHtml(stripTags(heading[1]));
    else if (titleDiv?.[1]) title = decodeHtml(stripTags(titleDiv[1]));
    if (!title) {
      const h3 = block.match(/<h3[^>]+class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
      if (h3?.[1]) title = decodeHtml(stripTags(h3[1]));
    }

    const linkMatch = block.match(/<a[^>]+class="[^"]*s-item__link[^"]*"[^>]+href="([^"]+)"/i);
    const priceMatch = block.match(/<span[^>]+class="[^"]*s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

    let captionBlob = "";
    const cap1Re = /class="[^"]*s-item__caption-section[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let capM: RegExpExecArray | null;
    while ((capM = cap1Re.exec(block))) {
      captionBlob += ` ${decodeHtml(stripTags(capM[1] ?? ""))}`;
    }
    const cap2 = block.match(/class="[^"]*s-item__title--tagblock[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (cap2?.[1]) captionBlob += ` ${decodeHtml(stripTags(cap2[1]))}`;
    const cap3 = block.match(/class="[^"]*s-item__dynamic[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (cap3?.[1]) captionBlob += ` ${decodeHtml(stripTags(cap3[1]))}`;
    const cap4 = block.match(/class="[^"]*s-item__caption--signal[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (cap4?.[1]) captionBlob += ` ${decodeHtml(stripTags(cap4[1]))}`;
    captionBlob = captionBlob.replace(/\s+/g, " ").trim();

    if (!title || !linkMatch) continue;
    const itemUrl = decodeHtml(linkMatch[1].trim());
    if (!itemUrl.startsWith("http")) continue;
    if (/shop on ebay/i.test(title)) continue;

    const priceText = priceMatch ? decodeHtml(stripTags(priceMatch[1])) : "";
    const priceUsd = parseEbayUsdAverage(priceText) ?? parseEbayUsdFirst(priceText);
    const observedAt = parseEbayCaptionDateIso(captionBlob) ?? parseEbayCaptionDateIso(block);

    const slabHaystack = `${title} ${priceText} ${captionBlob}`;
    if (priceUsd == null) continue;

    evidence.push({
      kind: "sold",
      title,
      priceUsd,
      observedAt,
      url: itemUrl,
      source: "eBay",
      slab: inferSlab(slabHaystack),
    });
  }

  return { evidence, blocked: false };
}

/**
 * Sold comps pipeline (recommended order):
 * 1. Apify sold actor (production)
 * 2. Marketplace Insights stub (when approved)
 * 3. Finding API (legacy, non-blocking)
 * 4. Completed-listings HTML scrape
 */
async function collectEbaySoldEvidence(card: ExtractedCard): Promise<{ evidence: MarketEvidence[]; warnings: string[] }> {
  const warnings: string[] = [];
  const candidates = ebaySoldQueryCandidates(card);
  if (candidates.length === 0) return { evidence: [], warnings };

  const merged: MarketEvidence[] = [];

  if (isApifyEbaySoldConfigured()) {
    const apifyRows = await fetchApifyEbaySoldForCard(card).catch(() => []);
    if (apifyRows.length > 0) merged.push(...apifyRows);
  }

  if (isEbayMarketplaceInsightsConfigured()) {
    const insightsRows = await fetchEbayMarketplaceInsightsSold(card).catch(() => []);
    if (insightsRows.length > 0) merged.push(...insightsRows);
  }

  const dedupedEarly = filterEbaySoldForCard(card, dedupeSold(merged));
  if (dedupedEarly.length >= MAX_ITEMS) {
    return { evidence: dedupedEarly.slice(0, MAX_ITEMS), warnings };
  }

  const categoryId = ebaySearchCategoryIdForCard(card);
  const findingDisabled = process.env.EBAY_DISABLE_FINDING === "1";
  const fromFinding: MarketEvidence[] = [];

  if (!findingDisabled && getEbayFindingAppId()) {
    for (const q of candidates) {
      const finding = await fetchEbayFindingCompletedSold(q, 24, categoryId).catch(() => []);
      fromFinding.push(...finding);
      if (finding.length >= 3) break;
    }
  }
  merged.push(...fromFinding);

  const dedupedMid = filterEbaySoldForCard(card, dedupeSold(merged));
  if (dedupedMid.length >= MAX_ITEMS) {
    return { evidence: dedupedMid.slice(0, MAX_ITEMS), warnings };
  }

  let sawBlocked = false;
  for (const q of candidates) {
    const { evidence, blocked } = await scrapeEbaySoldHtml(card, q);
    if (blocked) sawBlocked = true;
    if (evidence.length > 0) {
      merged.push(...evidence);
      if (dedupeSold(merged).length >= MAX_ITEMS) break;
    }
  }
  if (sawBlocked && merged.length === 0) {
    warnings.push("eBay returned a bot/captcha page instead of results (try again or route fetches through a proxy).");
  }

  const evidence = filterEbaySoldForCard(card, dedupeSold(merged)).slice(0, MAX_ITEMS);
  if (evidence.length === 0 && candidates.length > 0) {
    if (isApifyEbaySoldConfigured()) {
      warnings.push("No eBay sold comps from Apify — check APIFY_API_TOKEN and actor quota, or try again.");
    } else if (findingDisabled) {
      warnings.push("No eBay sold rows — set APIFY_API_TOKEN (Apify sold actor) or allow Finding/HTML fallback.");
    } else if (!getEbayFindingAppId()) {
      warnings.push("No eBay sold rows — add APIFY_API_TOKEN for Apify sold comps, or EBAY_FINDING_APP_ID / production EBAY_CLIENT_ID.");
    } else {
      warnings.push("No eBay sold rows matched this card — tighten scan identity or verify marketplace access.");
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
