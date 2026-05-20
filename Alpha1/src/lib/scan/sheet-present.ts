import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { formatAskingPriceCompact as formatAskingPriceUnified } from "@/lib/scan/specimen-present";
import type { FairValueBasis } from "@/lib/market/fair-value";
import {
  MARKET_SOURCES,
  buildHubUrlMap,
  inferMarketSourceFromUrl,
  normalizeMarketSource,
  preferredHubBrowseUrl,
  sourceLabel,
  type MarketSourceId,
} from "@/lib/market/sources";
import type { MarketEvidence } from "@/lib/scan/schemas";

function formatUsd(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

const FMV_BASIS_LABEL: Partial<Record<FairValueBasis, string>> = {
  sold_median: "",
  active_median: "median ask",
  reference_median: "guide ref",
  sticker_anchor: "from sticker",
  tcg_catalog: "TCGPlayer market",
};

/** Full phrase for detail panels (matches Pokédex market panel). */
const FMV_BASIS_PHRASE: Partial<Record<FairValueBasis, string>> = {
  sold_median: "recent sold median",
  active_median: "active listing median",
  reference_median: "price guide median",
  sticker_anchor: "sticker price",
  tcg_catalog: "TCGPlayer market price",
};

export function formatFmvBasisLabel(basis: FairValueBasis | null | undefined): string | null {
  if (!basis) return null;
  return FMV_BASIS_PHRASE[basis] ?? basis.replace(/_/g, " ");
}

function compPriceOnly(item: MarketEvidence | undefined): string {
  if (!item?.priceUsd || !Number.isFinite(item.priceUsd)) return "—";
  return formatUsd(item.priceUsd);
}

function evidenceTimeMs(item: MarketEvidence): number {
  if (!item.observedAt) return 0;
  const t = new Date(item.observedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortEvidenceNewestFirst(items: MarketEvidence[]): MarketEvidence[] {
  return [...items].sort((a, b) => evidenceTimeMs(b) - evidenceTimeMs(a));
}

function firstMatchSorted(
  specimen: ScanSpecimen,
  predicate: (item: MarketEvidence) => boolean,
): MarketEvidence | undefined {
  return sortEvidenceNewestFirst(specimen.context.marketEvidence).find(predicate);
}

function formatEvidence(item: MarketEvidence | undefined, note?: string): string {
  if (!item) return "—";
  const price = formatUsd(item.priceUsd);
  const date = item.observedAt ? new Date(item.observedAt).toLocaleDateString() : "date n/a";
  const source = item.source ?? "source n/a";
  const tail = note ? ` · ${note}` : "";
  return `${price} · ${date} · ${source}${tail}`;
}

export function formatFairMarketValue(specimen: ScanSpecimen): string {
  const value = specimen.context.fairValueUsd;
  if (value == null) return "—";
  const basis = specimen.context.fairValueBasis;
  const label = basis ? FMV_BASIS_LABEL[basis] : "";
  const suffix = label ? ` · ${label}` : "";
  return `${formatUsd(value)}${suffix}`;
}

export function formatFairMarketValueHero(specimen: ScanSpecimen): {
  amount: string;
  basis: string | null;
} {
  const value = specimen.context.fairValueUsd;
  if (value == null) return { amount: "—", basis: null };
  return {
    amount: formatUsd(value),
    basis: formatFmvBasisLabel(specimen.context.fairValueBasis),
  };
}

export function formatCompChipRawSold(specimen: ScanSpecimen): string {
  const strict = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && (!item.slab || /raw/i.test(item.slab)) && !/psa\s*10|black\s*label/i.test(psa10Haystack(item)),
  );
  if (strict) return compPriceOnly(strict);
  const anyRawish = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && !/psa\s*10|black\s*label/i.test(psa10Haystack(item)),
  );
  return compPriceOnly(anyRawish);
}

export function formatCompChipPsa10Sold(specimen: ScanSpecimen): string {
  const strict = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && /psa\s*10/i.test(psa10Haystack(item)),
  );
  if (strict) return compPriceOnly(strict);
  const loose = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && /psa\s*10|gem\s*mint\s*10/i.test(psa10Haystack(item)),
  );
  return compPriceOnly(loose);
}

export function formatCompChipListed(specimen: ScanSpecimen): string {
  const priced = firstMatchSorted(specimen, activeWithPrice);
  return compPriceOnly(priced);
}

export function marketDataReady(specimen: ScanSpecimen): boolean {
  return (
    specimen.context.marketEvidence.length > 0 ||
    specimen.context.marketSourceLinks.length > 0 ||
    specimen.context.fairValueUsd != null
  );
}

export function formatStickerPrice(specimen: ScanSpecimen): string {
  return formatAskingPriceUnified(specimen);
}

function soldWithPrice(item: MarketEvidence): boolean {
  return item.kind === "sold" && item.priceUsd != null && Number.isFinite(item.priceUsd);
}

function activeWithPrice(item: MarketEvidence): boolean {
  return item.kind === "active" && item.priceUsd != null && Number.isFinite(item.priceUsd);
}

function psa10Haystack(item: MarketEvidence): string {
  return `${item.slab ?? ""} ${item.title}`;
}

function bgsBlHaystack(item: MarketEvidence): string {
  return `${item.slab ?? ""} ${item.title}`;
}

export function formatLatestRawSold(specimen: ScanSpecimen): string {
  const strict = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && (!item.slab || /raw/i.test(item.slab)) && !/psa\s*10|black\s*label/i.test(psa10Haystack(item)),
  );
  if (strict) return formatEvidence(strict);
  const anyRawish = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && !/psa\s*10|black\s*label/i.test(psa10Haystack(item)),
  );
  if (anyRawish) return formatEvidence(anyRawish, "nearest sold");
  const anySold = firstMatchSorted(specimen, soldWithPrice);
  return formatEvidence(anySold, anySold ? "nearest sold" : undefined);
}

export function formatLatestActive(specimen: ScanSpecimen): string {
  const priced = firstMatchSorted(specimen, activeWithPrice);
  if (priced) return formatEvidence(priced);
  const active = firstMatchSorted(specimen, (item) => item.kind === "active");
  if (active?.url) {
    const src = active.source ?? "listing";
    return `See listing · date n/a · ${src}`;
  }
  return "— · open Sources for live asks";
}

export function formatLatestPsa10Sold(specimen: ScanSpecimen): string {
  const strict = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && /psa\s*10/i.test(psa10Haystack(item)),
  );
  if (strict) return formatEvidence(strict);
  const loose = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && /psa\s*10|gem\s*mint\s*10/i.test(psa10Haystack(item)),
  );
  if (loose) return formatEvidence(loose, "PSA 10 comp");
  const anySold = firstMatchSorted(specimen, soldWithPrice);
  return formatEvidence(anySold, anySold ? "nearest sold" : undefined);
}

export function formatLatestBgsBlackLabelSold(specimen: ScanSpecimen): string {
  const strict = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && /(bgs).*(black\s*label)|black\s*label|pristine\s*10/i.test(bgsBlHaystack(item)),
  );
  if (strict) return formatEvidence(strict);
  const loose = firstMatchSorted(
    specimen,
    (item) => soldWithPrice(item) && /black\s*label|bgs.*10\s*prist/i.test(bgsBlHaystack(item)),
  );
  if (loose) return formatEvidence(loose, "BL comp");
  const anySold = firstMatchSorted(specimen, soldWithPrice);
  return formatEvidence(anySold, anySold ? "nearest sold" : undefined);
}

export type SourceSummary = {
  label: string;
  evidenceCount: number;
  hasSold: boolean;
  hasActive: boolean;
  link: string | null;
};

function normalizeSourceLabel(item: MarketEvidence): string {
  const raw = item.source?.trim();
  if (raw && !/^null$/i.test(raw) && raw.toLowerCase() !== "undefined") return raw;
  if (item.url) {
    try {
      const host = new URL(item.url).hostname.replace(/^www\./, "");
      if (host) return host;
    } catch {
      /* ignore */
    }
  }
  return "Unsourced";
}

export function summarizeSources(specimen: ScanSpecimen): SourceSummary[] {
  const hub = buildHubUrlMap(specimen.context.marketSourceLinks);
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

  for (const item of specimen.context.marketEvidence) {
    const fromUrl = item.url ? inferMarketSourceFromUrl(item.url) : null;
    const fromName = normalizeMarketSource(item.source ?? null);
    const sourceId: MarketSourceId | null = fromUrl ?? fromName;
    const displayLabel = sourceId ? sourceLabel(sourceId) : normalizeSourceLabel(item);
    const key = sourceId ?? `other:${displayLabel}`;
    const row = ensureRow(key, displayLabel);
    row.evidenceCount += 1;
    if (item.kind === "sold") row.hasSold = true;
    if (item.kind === "active") row.hasActive = true;

    const canonical = sourceId ? preferredHubBrowseUrl(hub.get(sourceId)) : null;
    if (canonical) {
      row.link = canonical;
    } else if (!sourceId && item.url && !row.link) {
      row.link = item.url;
    } else if (sourceId && !canonical && item.url) {
      row.link = item.url;
    }
  }

  for (const def of MARKET_SOURCES) {
    const lanes = hub.get(def.id);
    const browse = lanes ? preferredHubBrowseUrl(lanes) : null;
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

  return Array.from(rows.values()).sort(
    (a, b) => b.evidenceCount - a.evidenceCount || a.label.localeCompare(b.label),
  );
}

export function formatSourcesSummary(specimen: ScanSpecimen): string {
  const summary = summarizeSources(specimen);
  if (summary.length === 0) return "—";
  return summary
    .map((entry) => {
      const lanes: string[] = [];
      if (entry.hasSold) lanes.push("sold");
      if (entry.hasActive) lanes.push("listed");
      const tag = lanes.length ? ` (${lanes.join("/")})` : "";
      const count = entry.evidenceCount ? ` ×${entry.evidenceCount}` : "";
      return `${entry.label}${tag}${count}`;
    })
    .join(" · ");
}
