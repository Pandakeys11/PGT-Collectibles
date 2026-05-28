import { enrichEbaySoldEvidence } from "@/lib/market/ebay-evidence-enrich";
import {
  parseEbayCaptionDateIso,
  parseEbayUsdAverage,
  parseEbayUsdFirst,
} from "@/lib/market/ebay-sold-common";
import type { MarketEvidence } from "@/lib/scan/schemas";

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

/** JSON-LD / embedded listing blobs on modern eBay SERP. */
function parseEbaySoldFromEmbeddedJson(html: string): MarketEvidence[] {
  const out: MarketEvidence[] = [];
  const seen = new Set<string>();

  const push = (title: string, url: string, priceUsd: number, observedAt: string | null) => {
    const key = `${url}|${priceUsd}`;
    if (seen.has(key) || !title || priceUsd <= 0) return;
    seen.add(key);
    out.push(
      enrichEbaySoldEvidence({
        kind: "sold",
        title: title.slice(0, 240),
        priceUsd,
        observedAt,
        url,
        source: "eBay",
        slab: inferSlab(title),
        saleType: "auction",
        confidence: 0.82,
      }),
    );
  };

  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ld: RegExpExecArray | null;
  while ((ld = ldRe.exec(html)) && out.length < MAX_ITEMS) {
    try {
      const json = JSON.parse(ld[1]) as unknown;
      const items = Array.isArray(json) ? json : [json];
      for (const row of items) {
        const obj = row as {
          "@type"?: string;
          itemListElement?: Array<{ item?: { name?: string; url?: string } }>;
          name?: string;
          url?: string;
          offers?: { price?: string | number; priceCurrency?: string };
        };
        if (Array.isArray(obj.itemListElement)) {
          for (const el of obj.itemListElement) {
            const name = el.item?.name?.trim();
            const url = el.item?.url?.trim();
            if (!name || !url?.includes("ebay.com/itm")) continue;
            /* title-only rows resolved via s-item pass */
          }
        }
        if (obj.name && obj.url?.includes("ebay.com/itm")) {
          const price = Number(obj.offers?.price);
          if (Number.isFinite(price) && price > 0) push(obj.name, obj.url, price, null);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const itmRe =
    /href="(https:\/\/www\.ebay\.com\/itm\/[^"?]+)"[^>]*>[\s\S]{0,1200}?(?:s-item__price|price)[^>]*>([\s\S]*?)<\//gi;
  let m: RegExpExecArray | null;
  while ((m = itmRe.exec(html)) && out.length < MAX_ITEMS) {
    const url = decodeHtml(m[1]);
    const block = m[0];
    const titleMatch = block.match(/role=["']heading["'][^>]*>([\s\S]*?)<\/span>/i);
    const title = titleMatch ? stripTags(decodeHtml(titleMatch[1])) : "";
    const priceText = stripTags(decodeHtml(m[2] ?? ""));
    const priceUsd = parseEbayUsdAverage(priceText) ?? parseEbayUsdFirst(priceText);
    if (priceUsd != null) push(title || "eBay listing", url, priceUsd, null);
  }

  return out.filter((r) => r.priceUsd != null && (r.priceUsd ?? 0) > 0).slice(0, MAX_ITEMS);
}

/** Modern eBay SERP uses `s-card` (2024+) instead of legacy `s-item`. */
function parseEbaySoldScardItems(html: string): MarketEvidence[] {
  const evidence: MarketEvidence[] = [];
  const seen = new Set<string>();
  const cardRe =
    /class="[^"]*\bs-card\b[^"]*"[^>]*data-listingid="(\d{9,})"[\s\S]*?(?=class="[^"]*\bs-card\b|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = cardRe.exec(html)) && evidence.length < MAX_ITEMS) {
    const block = match[0];
    const listingId = match[1];
    const urlMatch =
      block.match(/href="(https?:\/\/[^"]*ebay\.com\/itm\/\d+[^"]*)"/i) ||
      block.match(/href="(https?:\/\/[^"]*ebay\.com\/itm\/[^"]+)"/i);
    let url = urlMatch ? decodeHtml(urlMatch[1].replace(/&amp;/g, "&")) : "";
    if (!url || /itm\/123456\b/i.test(url)) {
      url = `https://www.ebay.com/itm/${listingId}`;
    }
    if (seen.has(url)) continue;

    let title = "";
    const titleMatch =
      block.match(/class="[^"]*s-card__title[^"]*"[^>]*>[\s\S]*?<[^>]+>([\s\S]*?)<\//i) ||
      block.match(/class="[^"]*s-card__title[^"]*"[^>]*>([\s\S]*?)<\//i);
    if (titleMatch?.[1]) title = decodeHtml(stripTags(titleMatch[1]));

    const priceMatch =
      block.match(/class="[^"]*s-card__price[^"]*"[^>]*>([\s\S]*?)<\//i) ||
      block.match(/\$\s*[\d,]+(?:\.\d{2})?/);
    const priceText = priceMatch
      ? priceMatch[1]
        ? decodeHtml(stripTags(priceMatch[1]))
        : String(priceMatch[0])
      : "";
    const priceUsd = parseEbayUsdAverage(priceText) ?? parseEbayUsdFirst(priceText);
    if (!title || priceUsd == null) continue;
    if (/shop on ebay|sponsored/i.test(title)) continue;

    seen.add(url);
    evidence.push(
      enrichEbaySoldEvidence({
        kind: "sold",
        title,
        priceUsd,
        observedAt: parseEbayCaptionDateIso(block),
        url,
        source: "eBay",
        slab: inferSlab(`${title} ${priceText}`),
        saleType: "auction",
        confidence: 0.8,
      }),
    );
  }

  return evidence;
}

/** Classic `s-item` list markup on completed/sold search pages. */
export function parseEbaySoldHtmlItems(html: string): MarketEvidence[] {
  const fromJson = parseEbaySoldFromEmbeddedJson(html);
  if (fromJson.length >= 4) return fromJson;

  const fromScard = parseEbaySoldScardItems(html);
  if (fromScard.length >= 3) return fromScard;

  const itemPattern = /<li[^>]*(?:class="[^"]*\bs-item\b[^"]*"|class='[^']*\bs-item[^']*')[^>]*>([\s\S]*?)<\/li>/gi;
  const evidence: MarketEvidence[] = [...fromJson];
  const seen = new Set(evidence.map((e) => e.url));
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(html)) && evidence.length < MAX_ITEMS) {
    const block = match[1];
    if (!block.includes("s-item__link") && !block.includes("/itm/")) continue;

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

    const linkMatch =
      block.match(/<a[^>]+class="[^"]*s-item__link[^"]*"[^>]+href="([^"]+)"/i) ||
      block.match(/href="(https:\/\/www\.ebay\.com\/itm\/[^"]+)"/i);
    const priceMatch = block.match(/<span[^>]+class="[^"]*s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

    let captionBlob = "";
    const cap1Re = /class="[^"]*s-item__caption-section[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let capM: RegExpExecArray | null;
    while ((capM = cap1Re.exec(block))) {
      captionBlob += ` ${decodeHtml(stripTags(capM[1] ?? ""))}`;
    }

    if (!title || !linkMatch) continue;
    const itemUrl = decodeHtml(linkMatch[1].trim());
    if (!itemUrl.startsWith("http") || seen.has(itemUrl)) continue;
    if (/shop on ebay/i.test(title)) continue;

    const priceText = priceMatch ? decodeHtml(stripTags(priceMatch[1])) : "";
    const priceUsd = parseEbayUsdAverage(priceText) ?? parseEbayUsdFirst(priceText);
    const observedAt = parseEbayCaptionDateIso(captionBlob) ?? parseEbayCaptionDateIso(block);
    if (priceUsd == null) continue;

    seen.add(itemUrl);
    evidence.push(
      enrichEbaySoldEvidence({
        kind: "sold",
        title,
        priceUsd,
        observedAt,
        url: itemUrl,
        source: "eBay",
        slab: inferSlab(`${title} ${priceText} ${captionBlob}`),
        saleType: "auction",
      }),
    );
  }

  const merged = [...fromScard, ...evidence];
  return merged.slice(0, MAX_ITEMS);
}

export function countEbaySoldHtmlSignals(html: string): number {
  const scard = html.match(/data-listingid="\d{9,}"/gi) ?? [];
  const items = html.match(/class="[^"]*\bs-item\b/gi) ?? [];
  const itm = html.match(/\/itm\/\d{9,}/gi) ?? [];
  return Math.max(scard.length, items.length, Math.min(itm.length, 80));
}
