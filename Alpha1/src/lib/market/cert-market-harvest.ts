import { withTimeout } from "@/lib/async-timeout";
import { ebayGradedQueryCandidates } from "@/lib/market/graded-sales-harvest";
import { searchWeb } from "@/lib/market/web-search";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

function snippetToCertEvidence(
  card: ExtractedCard,
  row: { title: string; url: string; snippet: string },
  lane: "sold" | "active",
): MarketEvidence | null {
  const hay = `${row.title} ${row.snippet}`;
  const priceMatch = hay.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  const priceUsd = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
  const kind: MarketEvidence["kind"] =
    lane === "sold" || /sold|completed|hammer|ended/i.test(hay)
      ? "sold"
      : /listed|asking|auction|buy now|for sale/i.test(hay)
        ? "active"
        : "reference";
  if (kind === "sold" && priceUsd == null) return null;
  return {
    kind,
    title: row.title.slice(0, 160),
    priceUsd: priceUsd != null && Number.isFinite(priceUsd) ? priceUsd : null,
    observedAt: null,
    url: row.url.startsWith("http") ? row.url : null,
    source: "eBay",
    slab: card.grader && card.grade ? `${card.grader} ${card.grade}` : null,
    confidence: 0.68,
  };
}

/**
 * Cert-first market rows: eBay sold/active and web snippets for the exact cert #.
 */
export async function harvestCertSpecificMarketEvidence(
  card: ExtractedCard,
): Promise<MarketEvidence[]> {
  if (!hasReadableCertNumber(card.cert) || !card.grader?.trim()) return [];

  const certDigits = card.cert!.replace(/\D/g, "");
  const queries = ebayGradedQueryCandidates(card).slice(0, 4);
  const evidence: MarketEvidence[] = [];

  const settled = await Promise.allSettled(
    queries.map((q) =>
      withTimeout(searchWeb(`${q} site:ebay.com`, 6), 8_000, "cert ebay snippet").then(
        (results) => ({ q, results }),
      ),
    ),
  );

  for (const row of settled) {
    if (row.status !== "fulfilled") continue;
    for (const r of row.value.results) {
      const hay = `${r.title} ${r.snippet}`;
      if (!hay.includes(certDigits)) continue;
      const lane = /sold|completed|hammer/i.test(hay) ? "sold" : "active";
      const ev = snippetToCertEvidence(card, r, lane);
      if (ev) evidence.push(ev);
    }
  }

  const seen = new Set<string>();
  return evidence.filter((it) => {
    const key = `${it.kind}|${it.url ?? ""}|${it.title}|${it.priceUsd ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
