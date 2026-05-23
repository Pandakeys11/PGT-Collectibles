import { buildMarketSearchIdentity } from "@/lib/market/market-search-identity";
import { searchWeb } from "@/lib/market/web-search";
import { ebaySoldScrapeAdapter } from "@/lib/market/adapters/ebay-sold-scrape";
import { ebayBrowseAdapter } from "@/lib/market/adapters/ebay";
import { buildGradedHubLinks } from "@/lib/market/graded-hub-urls";
import { buildRegistryUrl } from "@/lib/market/cert-lookup";
import { hasReadableCertNumber } from "@/lib/scan/graded-slab";
import { classifyCardLane } from "@/lib/scan/lane";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

function compact(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/** Cert-first eBay query variants (graded slabs). */
export function ebayGradedQueryCandidates(card: ExtractedCard): string[] {
  const base = compact([
    card.name,
    card.set,
    card.printStamps,
    card.grader,
    card.grade,
    card.year,
  ]);
  const certDigits = hasReadableCertNumber(card.cert)
    ? card.cert!.replace(/\D/g, "")
    : "";
  const out: string[] = [];
  const push = (q: string) => {
    const t = q.replace(/\s+/g, " ").trim();
    if (t.length >= 3) out.push(t);
  };

  if (certDigits.length >= 6 && card.grader) {
    push(`${card.grader} ${certDigits}`);
    push(`${card.grader} cert ${certDigits}`);
    push(compact([card.grader, certDigits, card.name, card.grade]));
  }
  push(compact([base, "sold"]));
  push(base);

  const seen = new Set<string>();
  return out.filter((q) => {
    if (seen.has(q)) return false;
    seen.add(q);
    return true;
  });
}

type PlatformSnippetQuery = {
  platform: string;
  lane: "sold" | "active";
  query: string;
};

export function buildGradedPlatformQueries(card: ExtractedCard): PlatformSnippetQuery[] {
  const searchId = buildMarketSearchIdentity(card);
  const identity = searchId.platform;
  const certQ =
    card.cert && card.grader
      ? `${card.grader} ${card.cert.replace(/\D/g, "")}`
      : null;

  const queries: PlatformSnippetQuery[] = [
    { platform: "cardladder", lane: "sold", query: `site:cardladder.com ${certQ ?? identity} sold` },
    { platform: "cardladder", lane: "active", query: `site:cardladder.com ${identity} listing` },
    { platform: "alt", lane: "sold", query: `site:alt.xyz ${identity} sold` },
    { platform: "alt", lane: "active", query: `site:alt.xyz ${identity} auction` },
    { platform: "ebay", lane: "sold", query: `site:ebay.com ${searchId.ebayPrimary} sold` },
    { platform: "goldin", lane: "sold", query: `site:goldin.co ${identity} sold` },
    { platform: "fanatics", lane: "sold", query: `site:fanaticscollect.com ${identity} sold` },
  ];

  if (certQ) {
    queries.unshift({
      platform: "cardladder",
      lane: "sold",
      query: `site:cardladder.com "${certQ}" sales`,
    });
  }

  return queries;
}

function snippetToEvidenceForCard(
  card: ExtractedCard,
  row: { title: string; url: string; snippet: string },
  source: string,
  lane: "sold" | "active",
): MarketEvidence | null {
  const hay = `${row.title} ${row.snippet}`;
  const priceMatch = hay.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  const priceUsd = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null;
  const kind: MarketEvidence["kind"] =
    lane === "sold" || /sold|completed|hammer/i.test(hay)
      ? "sold"
      : /listed|asking|auction|buy now/i.test(hay)
        ? "active"
        : "reference";
  if (kind === "sold" && priceUsd == null) return null;
  return {
    kind,
    title: row.title.slice(0, 160),
    priceUsd: priceUsd != null && Number.isFinite(priceUsd) ? priceUsd : null,
    observedAt: null,
    url: row.url.startsWith("http") ? row.url : null,
    source,
    slab: card.grader && card.grade ? `${card.grader} ${card.grade}` : null,
  };
}

export async function collectGradedPlatformSnippets(card: ExtractedCard): Promise<MarketEvidence[]> {
  const queries = buildGradedPlatformQueries(card);
  const settled = await Promise.allSettled(
    queries.map((q) => searchWeb(q.query, 5).then((results) => ({ ...q, results }))),
  );

  const labelFor: Record<string, string> = {
    cardladder: "Card Ladder",
    alt: "ALT",
    ebay: "eBay",
    goldin: "Goldin",
    fanatics: "Fanatics Collect",
  };

  const evidence: MarketEvidence[] = [];
  for (const row of settled) {
    if (row.status !== "fulfilled") continue;
    const { platform, lane, results } = row.value;
    const source = labelFor[platform] ?? platform;
    for (const r of results) {
      const ev = snippetToEvidenceForCard(card, r, source, lane);
      if (ev) evidence.push(ev);
    }
  }
  return evidence;
}

function dedupeEvidence(items: MarketEvidence[]): MarketEvidence[] {
  const seen = new Set<string>();
  const out: MarketEvidence[] = [];
  for (const it of items) {
    const key = `${it.kind}|${it.url ?? ""}|${it.title}|${it.priceUsd ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export type GradedHarvestResult = {
  evidence: MarketEvidence[];
  hubLinks: ReturnType<typeof buildGradedHubLinks>;
  notes: string[];
};

/**
 * No-GemRate graded pipeline: eBay API/scrape first, then Card Ladder/ALT/eBay DDG snippets.
 */
export async function harvestGradedMarketEvidence(card: ExtractedCard): Promise<GradedHarvestResult> {
  const notes: string[] = [];
  const evidence: MarketEvidence[] = [];
  const lane = classifyCardLane(card as Record<string, unknown>).lane;

  const registryUrl =
    card.cert && card.grader
      ? buildRegistryUrl(card.grader, card.cert)
      : null;
  const hubLinks = buildGradedHubLinks(card, { registryUrl });

  const runPlatformSnippets = lane === "graded" || Boolean(card.cert);

  const [ebaySold, ebayActive, platformSnippets] = await Promise.allSettled([
    ebaySoldScrapeAdapter.collect(card),
    ebayBrowseAdapter.collect(card),
    runPlatformSnippets ? collectGradedPlatformSnippets(card) : Promise.resolve([]),
  ]);

  if (ebaySold.status === "fulfilled") {
    evidence.push(...ebaySold.value.evidence);
    notes.push(`eBay sold scrape: ${ebaySold.value.evidence.length} row(s).`);
  }
  if (ebayActive.status === "fulfilled") {
    evidence.push(...ebayActive.value.evidence);
  }
  if (platformSnippets.status === "fulfilled" && platformSnippets.value.length > 0) {
    evidence.push(...platformSnippets.value);
    notes.push(`Card Ladder / ALT / eBay snippets: ${platformSnippets.value.length} row(s).`);
  }
  if (!runPlatformSnippets) {
    notes.push("Raw card — eBay sold/listing rows below; use platform links for Card Ladder / ALT depth.");
  }
  return {
    evidence: dedupeEvidence(evidence),
    hubLinks,
    notes,
  };
}
