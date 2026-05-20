import type { CatalogMarketSnapshot } from "@/lib/pokedex/catalog-market-snapshot";
import {
  MARKET_SOURCES,
  buildHubUrlMap,
  inferMarketSourceFromUrl,
  normalizeMarketSource,
  preferredHubBrowseUrl,
  sourceLabel,
  type MarketSourceId,
  type MarketSourceLink,
} from "@/lib/market/sources";
import type { FairValueBasis } from "@/lib/market/fair-value";
import type { MarketEvidence } from "@/lib/scan/schemas";
import { formatFmvBasisLabel, type SourceSummary } from "@/lib/scan/sheet-present";

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function compPriceOnly(item: MarketEvidence | null | undefined): string {
  if (!item?.priceUsd || !Number.isFinite(item.priceUsd)) return "—";
  return formatUsd(item.priceUsd);
}

export function catalogMarketReady(snapshot: CatalogMarketSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return (
    snapshot.marketEvidence.length > 0 ||
    snapshot.fairValueUsd != null ||
    snapshot.tcgVariants.length > 0
  );
}

export function formatCatalogFmvHero(snapshot: CatalogMarketSnapshot): {
  amount: string;
  basis: string | null;
} {
  const value = snapshot.fairValueUsd;
  if (value == null) return { amount: "—", basis: null };
  return {
    amount: formatUsd(value),
    basis: formatFmvBasisLabel(snapshot.fairValueBasis as FairValueBasis | null),
  };
}

export function formatCatalogCompRawSold(snapshot: CatalogMarketSnapshot): string {
  return compPriceOnly(snapshot.rawHighlight.latestSold);
}

export function formatCatalogCompPsa10Sold(snapshot: CatalogMarketSnapshot): string {
  return compPriceOnly(snapshot.highlights.psa10.latestSold);
}

export function formatCatalogCompListed(snapshot: CatalogMarketSnapshot): string {
  const listed =
    snapshot.rawHighlight.latestListed ??
    snapshot.recentListings.find((item) => item.kind === "active") ??
    null;
  return compPriceOnly(listed);
}

export function summarizeCatalogSources(
  snapshot: CatalogMarketSnapshot,
  marketSourceLinks: MarketSourceLink[],
): SourceSummary[] {
  const hub = buildHubUrlMap(marketSourceLinks);
  const rows = new Map<string, SourceSummary>();

  function ensureRow(key: string, label: string): SourceSummary {
    const existing = rows.get(key);
    if (existing) return existing;
    const created: SourceSummary = {
      label,
      evidenceCount: 0,
      hasSold: false,
      hasActive: false,
      link: null,
    };
    rows.set(key, created);
    return created;
  }

  for (const item of snapshot.marketEvidence) {
    const fromUrl = item.url ? inferMarketSourceFromUrl(item.url) : null;
    const fromName = normalizeMarketSource(item.source ?? null);
    const sourceId: MarketSourceId | null = fromUrl ?? fromName;
    const displayLabel = sourceId ? sourceLabel(sourceId) : (item.source?.trim() || "Index");
    const key = sourceId ?? `other:${displayLabel}`;
    const row = ensureRow(key, displayLabel);
    row.evidenceCount += 1;
    if (item.kind === "sold") row.hasSold = true;
    if (item.kind === "active") row.hasActive = true;
    const canonical = sourceId ? preferredHubBrowseUrl(hub.get(sourceId)) : null;
    if (canonical) row.link = canonical;
    else if (item.url && !row.link) row.link = item.url;
  }

  for (const def of MARKET_SOURCES) {
    const browse = preferredHubBrowseUrl(hub.get(def.id));
    if (!browse) continue;
    if (!rows.has(def.id)) {
      rows.set(def.id, {
        label: def.label,
        evidenceCount: 0,
        hasSold: false,
        hasActive: false,
        link: browse,
      });
    }
  }

  if (snapshot.tcgPlayerUrl) {
    const row = ensureRow("tcgplayer", "TCGPlayer");
    if (!row.link) row.link = snapshot.tcgPlayerUrl;
  }

  return Array.from(rows.values()).sort(
    (a, b) => b.evidenceCount - a.evidenceCount || a.label.localeCompare(b.label),
  );
}
