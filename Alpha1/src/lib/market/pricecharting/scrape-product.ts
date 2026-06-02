import * as cheerio from "cheerio";
import { fetchPriceChartingHtml } from "@/lib/market/pricecharting/fetch-html";
import {
  buildPriceChartingDirectUrls,
  buildPriceChartingSearchQueries,
  polishPriceChartingQuery,
} from "@/lib/market/pricecharting/queries";

export type PriceChartingComparableSale = {
  title: string;
  url: string | null;
  price: number;
  saleDate: string | null;
  platform: string | null;
};

export type PriceChartingProduct = {
  productId: string | null;
  productName: string;
  productUrl: string;
  imageUrl: string | null;
  prices: Record<string, number>;
  comparables: PriceChartingComparableSale[];
};

type SearchCandidate = { title: string; url: string };

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/★/g, " gold star ")
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDollar(value: string | null | undefined): number | null {
  const clean = String(value ?? "").replace(/[^0-9.]/g, "");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function absolutizeMarketHref(href: string | null | undefined): string | null {
  const raw = String(href ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `https://www.pricecharting.com${raw}`;
  return raw;
}

function parseComparablesLegacy($: cheerio.CheerioAPI): PriceChartingComparableSale[] {
  const rows: PriceChartingComparableSale[] = [];
  $("div[class^='completed-auctions-'] a[target='_blank']").each((_, element) => {
    const link = $(element);
    const title = link.text().replace(/\s+/g, " ").trim();
    const href = absolutizeMarketHref(link.attr("href"));
    if (!title) return;

    const saleRow = link.closest("tr");
    const price =
      parseDollar(saleRow.find(".js-price").first().text()) ??
      parseDollar(link.parent().text()) ??
      0;
    const saleDate =
      saleRow.find("td.date").text().trim() ||
      saleRow.find("td.details").first().text().trim() ||
      null;
    const platformText = saleRow.text();
    const platform =
      /\[eBay\]/i.test(platformText) || /ebay\./i.test(href ?? "")
        ? "eBay"
        : /\[TCGPlayer\]/i.test(platformText)
          ? "TCGPlayer"
          : /\[Fanatics\]/i.test(platformText)
            ? "Fanatics"
            : "PriceCharting";

    if (price > 0 && href) {
      rows.push({ title, url: href, price, saleDate, platform });
    }
  });
  return rows;
}

function parseComparablesFromTables($: cheerio.CheerioAPI): PriceChartingComparableSale[] {
  const rows: PriceChartingComparableSale[] = [];
  $("table").each((_, table) => {
    const $table = $(table);
    const headerJoined = $table
      .find("th")
      .map((__, th) =>
        $(th)
          .text()
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim(),
      )
      .get()
      .join(" ");
    if (!headerJoined.includes("sale date") || !headerJoined.includes("price")) return;

    $table.find("tr").each((__, tr) => {
      const $tr = $(tr);
      if ($tr.find("th").length > 0) return;
      const $tds = $tr.find("td");
      if ($tds.length < 3) return;

      const saleDate = $($tds[0]).text().replace(/\s+/g, " ").trim() || null;
      const link = $tr
        .find("a[href*='ebay.'], a[href*='tcgplayer'], a[href*='fanatics.com']")
        .first();
      const href = absolutizeMarketHref(link.attr("href"));
      const title = link.text().replace(/\s+/g, " ").trim();
      if (!title || !href) return;

      const rowText = $tr.text();
      let price =
        parseDollar($tr.find(".js-price").first().text()) ??
        parseDollar($($tds[$tds.length - 1]).text()) ??
        parseDollar($($tds[$tds.length - 2]).text()) ??
        0;
      if (!(price > 0)) price = parseDollar($tr.text()) ?? 0;

      const platform =
        /\[eBay\]/i.test(rowText) || /ebay\./i.test(href)
          ? "eBay"
          : /\[TCGPlayer\]/i.test(rowText)
            ? "TCGPlayer"
            : /\[Fanatics\]/i.test(rowText)
              ? "Fanatics"
              : "PriceCharting";

      if (price > 0) rows.push({ title, url: href, price, saleDate, platform });
    });
  });
  return rows;
}

function dedupeComparables(rows: PriceChartingComparableSale[]): PriceChartingComparableSale[] {
  const seen = new Set<string>();
  const out: PriceChartingComparableSale[] = [];
  for (const row of rows) {
    const key = `${row.url ?? ""}|${row.price}|${normalizeText(row.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function parseComparables($: cheerio.CheerioAPI): PriceChartingComparableSale[] {
  return dedupeComparables([...parseComparablesLegacy($), ...parseComparablesFromTables($)]).slice(
    0,
    80,
  );
}

function prioritizeComparablesForGrade(
  comparables: PriceChartingComparableSale[],
  gradeLabel: string | null | undefined,
): PriceChartingComparableSale[] {
  if (!gradeLabel || comparables.length === 0) return comparables;
  const needle = normalizeText(gradeLabel);
  if (!needle) return comparables;
  const hits = comparables.filter((c) => normalizeText(c.title).includes(needle));
  if (hits.length < 3) return comparables;
  const hitKeys = new Set(hits.map((c) => `${c.url ?? ""}|${c.price}|${normalizeText(c.title)}`));
  const rest = comparables.filter(
    (c) => !hitKeys.has(`${c.url ?? ""}|${c.price}|${normalizeText(c.title)}`),
  );
  return [...hits, ...rest].slice(0, 80);
}

function parseProductPage(html: string, productUrl: string): PriceChartingProduct | null {
  const $ = cheerio.load(html);
  const titleNode = $("#product_name").first();
  const productName = titleNode.text().replace(/\s+/g, " ").trim();
  if (!productName) return null;

  const prices: Record<string, number> = {};
  const stablePriceMap: Array<[string, string]> = [
    ["Ungraded", "#used_price"],
    ["Grade 7", "#complete_price"],
    ["Grade 8", "#new_price"],
    ["PSA 10", "#graded_price"],
  ];
  for (const [label, selector] of stablePriceMap) {
    const value = parseDollar($(`${selector} .price.js-price`).first().text());
    if (value != null) prices[label] = value;
  }

  $("#price_data tr").each((_, row) => {
    const header = $(row).find("th").first().text().replace(/\s+/g, " ").trim();
    const value = parseDollar($(row).find("td .price.js-price").first().text());
    if (header && value != null && prices[header] == null) prices[header] = value;
  });

  const imageUrl =
    $("#product_page_image img").attr("src") ?? $("img[itemprop='image']").attr("src") ?? null;

  return {
    productId: titleNode.attr("title") ?? null,
    productName,
    productUrl,
    imageUrl,
    prices,
    comparables: parseComparables($),
  };
}

async function searchPriceChartingCandidates(query: string): Promise<SearchCandidate[]> {
  const q = polishPriceChartingQuery(query);
  const url = `https://www.pricecharting.com/search-products?type=trading-cards&q=${encodeURIComponent(q)}`;
  const html = await fetchPriceChartingHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const seen = new Map<string, SearchCandidate>();
  $("a[href^='/game/']").each((_, element) => {
    const href = $(element).attr("href");
    const title = $(element).text().replace(/\s+/g, " ").trim();
    if (!href || !title) return;
    const candidate = { title, url: `https://www.pricecharting.com${href}` };
    if (!seen.has(candidate.url)) seen.set(candidate.url, candidate);
  });
  return Array.from(seen.values()).slice(0, 12);
}

async function searchPriceChartingCandidatesMulti(queries: string[]): Promise<SearchCandidate[]> {
  const unique = Array.from(new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 2))).slice(
    0,
    8,
  );
  if (unique.length === 0) return [];
  const batches = await Promise.all(unique.map((q) => searchPriceChartingCandidates(q)));
  const seen = new Map<string, SearchCandidate>();
  for (const batch of batches) {
    for (const c of batch) {
      if (!seen.has(c.url)) seen.set(c.url, c);
    }
  }
  return Array.from(seen.values()).slice(0, 28);
}

function nameTokenScore(normalizedTitle: string, name: string): number {
  const tokens = normalizeText(name)
    .split(" ")
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter((t) => normalizedTitle.includes(t)).length;
  return (hits / tokens.length) * 0.48;
}

function numberMatchScore(normalizedTitle: string, cardNumber?: string | null): number {
  if (!cardNumber) return 0;
  const raw = String(cardNumber).trim();
  if (!raw) return 0;
  const n = normalizeText(raw);
  const numOnly = normalizeText(raw.split("/")[0] ?? "");
  let s = 0;
  if (n && normalizedTitle.includes(n)) s += 0.22;
  if (numOnly && numOnly !== n && normalizedTitle.includes(numOnly)) s += 0.14;
  if (numOnly && normalizedTitle.includes(`#${numOnly}`)) s += 0.12;
  return Math.min(0.26, s);
}

function scoreCandidate(
  candidate: SearchCandidate,
  desired: {
    name: string;
    setName?: string | null;
    cardNumber?: string | null;
    gradeLabel?: string | null;
    isPromo?: boolean;
    isReverseHolofoil?: boolean;
  },
): number {
  const normalized = normalizeText(candidate.title);
  const urlNorm = normalizeText(candidate.url);
  const nameNorm = normalizeText(desired.name);
  let score = 0;
  if (normalized.includes(nameNorm)) score += 0.52;
  else score += nameTokenScore(normalized, desired.name);
  if (desired.setName && normalized.includes(normalizeText(desired.setName)))
    score += desired.isPromo ? 0.18 : 0.24;
  score += numberMatchScore(normalized, desired.cardNumber);
  if (desired.gradeLabel && normalized.includes(normalizeText(desired.gradeLabel))) score += 0.22;
  const slugReverse = urlNorm.includes("reverse-holo");
  const titleReverse =
    normalized.includes("reverse holo") || (/\breverse\b/.test(normalized) && /\bholo\b/.test(normalized));
  if (desired.isReverseHolofoil) {
    if (slugReverse || titleReverse) score += 0.28;
    else score -= 0.45;
  } else if (slugReverse || titleReverse) {
    score -= 0.32;
  }
  return score;
}

export type FindPriceChartingProductInput = {
  name: string;
  setId?: string | null;
  setName?: string | null;
  cardNumber?: string | null;
  isFirstEdition?: boolean;
  isShadowless?: boolean;
  isReverseHolofoil?: boolean;
  isPromo?: boolean;
  gradeLabel?: string | null;
  setTotal?: string | number | null;
  printedTotal?: string | number | null;
};

/** Scrape PriceCharting product page + completed-auction tables (PGTVision parity). */
export async function findPriceChartingProduct(
  input: FindPriceChartingProductInput,
): Promise<PriceChartingProduct | null> {
  const resolvedSetName = (input.setName ?? input.setId ?? "").trim() || null;
  const fullCardNumber = input.cardNumber ?? null;

  for (const directUrl of buildPriceChartingDirectUrls(input)) {
    const directHtml = await fetchPriceChartingHtml(directUrl);
    if (directHtml && !/404 page not found|Page Not Found/i.test(directHtml)) {
      const parsed = parseProductPage(directHtml, directUrl);
      if (parsed) {
        return {
          ...parsed,
          comparables: prioritizeComparablesForGrade(parsed.comparables, input.gradeLabel ?? null),
        };
      }
    }
  }

  const searchQueries = buildPriceChartingSearchQueries({
    ...input,
    setName: resolvedSetName,
  });
  const candidates = await searchPriceChartingCandidatesMulti(searchQueries);
  const scored = candidates
    .map((candidate) => {
      const normalizedCandidate = normalizeText(candidate.title);
      let score = scoreCandidate(candidate, {
        name: input.name,
        setName: resolvedSetName,
        cardNumber: fullCardNumber,
        gradeLabel: input.gradeLabel ?? null,
        isPromo: Boolean(input.isPromo),
        isReverseHolofoil: Boolean(input.isReverseHolofoil),
      });
      if (input.isFirstEdition && !normalizedCandidate.includes("1st edition")) score -= 0.55;
      if (!input.isFirstEdition && normalizedCandidate.includes("1st edition")) score -= 0.55;
      if (input.isShadowless && !normalizedCandidate.includes("shadowless")) score -= 0.55;
      if (!input.isShadowless && normalizedCandidate.includes("shadowless")) score -= 0.55;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  const second = scored[1];
  const minAccept = input.isPromo ? 0.36 : 0.4;
  const ok =
    top &&
    (top.score >= minAccept || (top.score >= 0.32 && (!second || top.score - second.score >= 0.09)));
  if (!ok || !top) return null;

  const bestHtml = await fetchPriceChartingHtml(top.candidate.url);
  if (!bestHtml) return null;
  const parsed = parseProductPage(bestHtml, top.candidate.url);
  if (!parsed) return null;
  return {
    ...parsed,
    comparables: prioritizeComparablesForGrade(parsed.comparables, input.gradeLabel ?? null),
  };
}
