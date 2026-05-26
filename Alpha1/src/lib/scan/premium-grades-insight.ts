import type { GradeHighlightView } from "@/lib/scan/specimen-market-view";
import { formatMarketDate, formatMarketUsd } from "@/lib/scan/specimen-market-view";
import type { ExtractedCard } from "@/lib/scan/schemas";

export type PremiumGradesInsight = {
  /** One-line card identity for the chat-style opener. */
  headline: string;
  /** 2–5 short paragraphs/lines (plain text, no markdown required in UI). */
  lines: string[];
  /** When session has zero priced premium rows. */
  isEmpty: boolean;
};

function cardHeadline(card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps">): string {
  const parts = [
    card.name?.trim(),
    [card.set, card.number].filter(Boolean).join(" · ") || null,
    card.year?.trim() ? `(${card.year})` : null,
    card.rarity?.trim(),
    card.printStamps?.trim(),
  ].filter(Boolean);
  return parts.join(" · ") || "This card";
}

function tierLine(row: GradeHighlightView): string {
  const sold = row.latestSold;
  const listed = row.latestListed;
  const soldBit = sold?.priceUsd != null
    ? `last sold ${formatMarketUsd(sold.priceUsd)}${sold.observedAt ? ` (${formatMarketDate(sold.observedAt)})` : ""}`
    : "no last sold in session";
  const askBit = listed?.priceUsd != null
    ? `live ask ${formatMarketUsd(listed.priceUsd)}${listed.observedAt ? ` (${formatMarketDate(listed.observedAt)})` : ""}`
    : "no live ask in session";
  const fmvBit =
    row.fmvUsd != null
      ? `session FMV ${formatMarketUsd(row.fmvUsd)} (${row.soldCount} sold · ${row.listedCount} listed)`
      : row.soldCount + row.listedCount > 0
        ? `${row.soldCount} sold · ${row.listedCount} listed (FMV needs more priced rows)`
        : "no comps in this session — use Search for eBay";

  return `${row.title}: ${soldBit}; ${askBit}; ${fmvBit}.`;
}

function compareTiers(rows: GradeHighlightView[]): string | null {
  const priced = rows
    .map((row) => ({
      title: row.title,
      fmv: row.fmvUsd,
      sold: row.latestSold?.priceUsd ?? null,
    }))
    .filter((r) => r.fmv != null || r.sold != null);
  if (priced.length < 2) return null;

  const byFmv = [...priced].sort((a, b) => (b.fmv ?? b.sold ?? 0) - (a.fmv ?? a.sold ?? 0));
  const top = byFmv[0];
  const low = byFmv[byFmv.length - 1];
  const topVal = top.fmv ?? top.sold;
  const lowVal = low.fmv ?? low.sold;
  if (topVal == null || lowVal == null || top.title === low.title) return null;

  return `In this session, ${top.title} prices highest (${formatMarketUsd(topVal)}) vs ${low.title} (${formatMarketUsd(lowVal)}). Premium slabs are thinner than PSA 9/10 mass market — confirm with sold search links before you buy or list.`;
}

/**
 * Chat-style read on premium grade lanes — grounded in session evidence only (not a live web crawl).
 */
export function buildPremiumGradesInsight(
  card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps">,
  rows: GradeHighlightView[],
): PremiumGradesInsight {
  const headline = cardHeadline(card);
  const tierLines = rows.map(tierLine);
  const hasPriced = rows.some(
    (r) =>
      r.fmvUsd != null ||
      r.latestSold?.priceUsd != null ||
      r.latestListed?.priceUsd != null,
  );

  if (!hasPriced) {
    return {
      headline,
      isEmpty: true,
      lines: [
        `No PSA 10, BGS Black Label, or CGC Pristine sold/ask rows in this scan session yet.`,
        "Tier Search links open grade-specific eBay sold and live listings. Live web research loads automatically below.",
      ],
    };
  }

  const lines: string[] = [
    `Recent sales & asks for ${headline} — from this scan session (eBay sold scrape, Finding API, snippets):`,
    ...tierLines,
  ];

  const compare = compareTiers(rows);
  if (compare) lines.push(compare);

  lines.push(
    "Numbers above are session comps, not a guarantee of today’s market. Use tier Search links to verify on eBay; rare tiers (BGS BL) often have few public sales.",
  );

  return { headline, lines, isEmpty: false };
}
