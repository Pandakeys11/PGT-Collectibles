import { classifyCardLane } from "@/lib/scan/lane";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** eBay Pokémon TCG category (Finding + completed search). */
export const EBAY_POKEMON_CARD_CATEGORY_ID = "2536";

function joinEbayKeywords(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Keyword string for eBay Pokémon TCG searches (`_sacat` already pins the category).
 * - **Raw:** `Pokemon {name} {set} {printStamps} {rarity} {year}` — no collector number.
 * - **Graded slab:** same + `{grader} {grade}` (e.g. `PSA 10`).
 */
export function buildEbayPokemonCardKeywordQuery(card: ExtractedCard): string {
  const { lane } = classifyCardLane(card as Record<string, unknown>);
  const head = joinEbayKeywords([
    "Pokemon",
    card.name,
    card.printedName,
    card.language,
    card.set,
    card.printStamps,
    card.rarity,
    card.year,
  ]);
  if (lane !== "graded") return head;
  const tail = joinEbayKeywords([card.grader, card.grade]);
  return joinEbayKeywords([head, tail]);
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function preCleanEbayQuery(query: string): string {
  if (!query) return "";
  return query
    .replace(/★/g, " Gold Star ")
    .replace(/●/g, " Common ")
    .replace(/◆/g, " Uncommon ")
    .replace(/☆/g, " Shinning ")
    .replace(/ex\b/gi, " EX ")
    .replace(/gx\b/gi, " GX ")
    .replace(/vmax\b/gi, " VMAX ")
    .replace(/vstar\b/gi, " VSTAR ");
}

export function cleanEbaySoldQuery(query: string): string {
  const pre = preCleanEbayQuery(query);
  return pre
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Query variants tried in order until sold rows are found. */
export function ebaySoldQueryCandidates(card: ExtractedCard): string[] {
  const primary = buildEbayPokemonCardKeywordQuery(card);
  const name = card.name?.trim();
  const set = card.set?.trim();
  const num = card.number?.trim();
  const details = card.details?.trim();
  const stamps = card.printStamps?.trim();
  const rarity = card.rarity?.trim();
  const y = card.year?.trim();

  const out: string[] = [];
  const push = (q: string) => {
    const c = cleanEbaySoldQuery(q);
    if (c.length >= 3) out.push(c);
  };

  push(primary);
  if (name && num) {
    push(joinEbayKeywords(["Pokemon", name, set, num, stamps, rarity, y]));
    push(joinEbayKeywords(["Pokemon", name, num, set, stamps, rarity, y]));
  }
  if (details) {
    push(joinEbayKeywords([primary, details]));
  }
  if (name) {
    push(joinEbayKeywords(["Pokemon", name, set, stamps, rarity, y]));
    push(joinEbayKeywords(["Pokemon", name, set, y]));
    push(name);
  }
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const q of out) {
    if (seen.has(q)) continue;
    seen.add(q);
    uniq.push(q);
  }
  return uniq;
}

/** Completed listings search URL (`_sacat` = Pokémon TCG). */
export function buildEbaySoldCompletedSearchUrl(
  query: string,
  options: { ipg?: number; auctionOnly?: boolean } = {},
): string {
  const q = cleanEbaySoldQuery(query);
  const ipg = Math.min(options.ipg ?? 60, 100);
  const params = new URLSearchParams({
    _nkw: q,
    _sacat: EBAY_POKEMON_CARD_CATEGORY_ID,
    LH_Sold: "1",
    LH_Complete: "1",
    rt: "nc",
    _sop: "1",
    _ipg: String(ipg),
  });
  if (options.auctionOnly) params.set("LH_Auction", "1");
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

export function isLikelyBlockedEbayHtml(html: string): boolean {
  const n = html.toLowerCase();
  return ["just a moment", "captcha", "access denied", "cf-browser-verification", "blocked", "pardon our interruption"].some(
    (t) => n.includes(t),
  );
}

/** First dollar amount in a price string. */
export function parseEbayUsdFirst(text: string): number | null {
  const m = String(text ?? "")
    .replace(/,/g, "")
    .match(/\$\s*([\d]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n < 250_000 ? n : null;
}

export function parseEbayUsdAverage(text: string): number | null {
  const s = String(text);
  const values: number[] = [];
  const re = /\$\s?([\d,]+(?:\.\d{2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n) && n >= 1 && n < 250_000) values.push(n);
  }
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Parse "Sold Mar 15, 2024" / "Ended …" into ISO date. */
export function parseEbaySoldEndedDateIso(text: string | null | undefined): string | null {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  const match = normalized.match(/(?:sold|ended)\s+([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/i);
  if (!match) return null;
  const monthIndex = MONTH_ABBR.findIndex((m) => m.toLowerCase() === String(match[1]).slice(0, 3).toLowerCase());
  if (monthIndex < 0) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return null;
  const d = new Date(Date.UTC(year, monthIndex, day));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function parseEbayCaptionDateIso(text: string | null | undefined): string | null {
  const iso = parseEbaySoldEndedDateIso(text);
  if (iso) return iso;
  const named = String(text ?? "").match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(20\d{2})/i,
  );
  if (!named) return null;
  const date = new Date(`${named[1]} ${named[2]}, ${named[3]}`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
