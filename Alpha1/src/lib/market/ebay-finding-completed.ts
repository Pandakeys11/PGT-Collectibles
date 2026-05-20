import { getEbayFindingAppId } from "@/lib/market/env-market";
import type { MarketEvidence } from "@/lib/scan/schemas";
import { cleanEbaySoldQuery, EBAY_POKEMON_CARD_CATEGORY_ID } from "@/lib/market/ebay-sold-common";

const EBAY_FINDING_ENDPOINT = "https://svcs.ebay.com/services/search/FindingService/v1";

function extractFindingApiError(payload: unknown): string | null {
  const p = payload as {
    errorMessage?: Array<{ error?: Array<{ message?: string[] | string }> }>;
  };
  const messages: unknown[] = [];
  if (Array.isArray(p?.errorMessage)) {
    for (const entry of p.errorMessage) {
      const errs = entry?.error;
      if (Array.isArray(errs)) messages.push(...errs);
    }
  }
  const text = messages
    .map((entry) => {
      const e = entry as { message?: string[] | string };
      const m = e.message;
      return Array.isArray(m) ? String(m[0] ?? "") : String(m ?? "");
    })
    .map((s) => s.trim())
    .filter(Boolean)
    .join("; ");
  return text || null;
}

function isFindingRateLimited(message: string | null | undefined): boolean {
  return /exceeded|ratelimit|number of times the operation is allowed to be called/i.test(String(message ?? ""));
}

let findingCompletedCooldownUntil = 0;
const EBAY_FINDING_COOLDOWN_MS = 15 * 60 * 1000;

function inferSlabFromHaystack(hay: string): string | null {
  if (/bgs.*black\s*label|black\s*label/i.test(hay)) return "BGS Black Label";
  if (/psa\s*10|gem\s*mint\s*10/i.test(hay)) return "PSA 10";
  if (/cgc/i.test(hay) && /cgc\s*10(\.0)?\b/i.test(hay)) return "CGC 10";
  if (/psa\s*9\b|cgc\s*9\b|bgs\s*9\b/i.test(hay)) return "PSA 9";
  return null;
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Finding returns `EndedWithSales` (not `Sold`) for completed sold listings. */
function isFindingCompletedSoldState(state: string | undefined): boolean {
  const s = String(state ?? "").trim().toLowerCase();
  if (!s) return true;
  if (s === "endedwithoutsales") return false;
  if (s === "active") return false;
  return true;
}

function endTimeToObservedAt(endTime: string | undefined): string | null {
  if (!endTime?.trim()) return null;
  const d = new Date(endTime);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Finding `findCompletedItems` (sold-only); HTML scrape covers failures and Sandbox. */
export async function fetchEbayFindingCompletedSold(
  query: string,
  limit: number,
): Promise<MarketEvidence[]> {
  if (process.env.EBAY_DISABLE_FINDING === "1") return [];
  const appId = getEbayFindingAppId();
  if (!appId) return [];
  if (Date.now() < findingCompletedCooldownUntil) return [];

  const finalQuery = cleanEbaySoldQuery(query);
  if (finalQuery.length < 2) return [];

  const queryString = [
    `OPERATION-NAME=findCompletedItems`,
    `SERVICE-VERSION=1.0.0`,
    `SECURITY-APPNAME=${encodeURIComponent(appId)}`,
    `RESPONSE-DATA-FORMAT=JSON`,
    `keywords=${encodeURIComponent(finalQuery)}`,
    `categoryId=${EBAY_POKEMON_CARD_CATEGORY_ID}`,
    `itemFilter(0).name=SoldItemsOnly`,
    `itemFilter(0).value=true`,
    `sortOrder=EndTimeLatest`,
    `paginationInput.entriesPerPage=${Math.min(Math.max(1, limit), 100)}`,
  ].join("&");

  const res = await fetch(`${EBAY_FINDING_ENDPOINT}?${queryString}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as Record<string, unknown>;
  const apiError = extractFindingApiError(data);
  if (apiError) {
    if (isFindingRateLimited(apiError)) {
      findingCompletedCooldownUntil = Date.now() + EBAY_FINDING_COOLDOWN_MS;
    }
    return [];
  }

  const root = asArray(
    (data as { findCompletedItemsResponse?: unknown }).findCompletedItemsResponse,
  )[0] as { searchResult?: unknown } | undefined;
  const searchBlock = asArray(root?.searchResult)[0] as { item?: unknown } | undefined;
  const rawItems = asArray(searchBlock?.item);

  const out: MarketEvidence[] = [];
  for (const row of rawItems) {
    const item = row as {
      title?: string[];
      itemId?: string[];
      sellingStatus?: Array<{
        currentPrice?: Array<{ __value__?: string; ["@currencyId"]?: string }>;
        sellingState?: string[];
      }>;
      viewItemURL?: string[];
      listingInfo?: Array<{ endTime?: string[] }>;
    };
    const title = String(item.title?.[0] ?? "").trim();
    const sellingState = String(item.sellingStatus?.[0]?.sellingState?.[0] ?? "");
    const priceRaw = item.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"];
    const price = priceRaw != null ? Number.parseFloat(String(priceRaw)) : NaN;
    const url = String(item.viewItemURL?.[0] ?? "").trim();
    const endTime = item.listingInfo?.[0]?.endTime?.[0];
    if (!title || !url.startsWith("http") || !Number.isFinite(price) || price <= 0) continue;
    if (!isFindingCompletedSoldState(sellingState)) continue;

    const hay = `${title} ${price}`;
    out.push({
      kind: "sold",
      title,
      priceUsd: price,
      observedAt: endTimeToObservedAt(endTime),
      url,
      source: "eBay",
      slab: inferSlabFromHaystack(hay),
    });
    if (out.length >= limit) break;
  }

  return out;
}
