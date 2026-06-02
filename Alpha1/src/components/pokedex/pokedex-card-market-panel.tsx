"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogMarketSnapshot, GradeHighlight } from "@/lib/pokedex/catalog-market-snapshot";
import type { FairValueBasis } from "@/lib/market/fair-value";
import {
  buildHubUrlMap,
  resolveEvidenceExternalUrl,
  type EbayGradeHub,
  type EbayGradeHubKey,
  type MarketSourceLink,
} from "@/lib/market/sources";
import { MarketSourceLogo } from "@/components/market/market-source-logo";
import { normalizeMarketSource } from "@/lib/market/sources";
import type { MarketEvidence } from "@/lib/scan/schemas";

type MarketPayload = {
  snapshot: CatalogMarketSnapshot;
  marketSourceLinks: MarketSourceLink[];
  ebayGradeHubs?: Record<EbayGradeHubKey, EbayGradeHub>;
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDelta(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${fmtUsd(n)}`;
}

const FMV_BASIS_PHRASE: Partial<Record<FairValueBasis, string>> = {
  sold_median: "recent sold median",
  active_median: "active listing median",
  reference_median: "price guide median",
  sticker_anchor: "sticker price",
  tcg_catalog: "TCGPlayer market price",
};

function formatFmvBasis(basis: FairValueBasis): string {
  return FMV_BASIS_PHRASE[basis] ?? basis.replace(/_/g, " ");
}

function labelTcgVariant(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function slabToEbayGradeKey(slab: string | null | undefined): EbayGradeHubKey {
  if (!slab) return "raw";
  if (/psa\s*10/i.test(slab)) return "psa10";
  if (/psa\s*9/i.test(slab)) return "psa9";
  if (/black\s*label|bgs.*black/i.test(slab)) return "bgsBlackLabel";
  if (/pristine|cgc/i.test(slab)) return "cgcPristine10";
  return "raw";
}

function EvidenceMeta({ item }: { item: MarketEvidence | null }) {
  if (!item) return <>No recent comp in index</>;
  const date = item.observedAt ? new Date(item.observedAt).toLocaleDateString() : "date n/a";
  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-1">
      <span className="font-mono">{fmtUsd(item.priceUsd)}</span>
      <span className="text-muted">·</span>
      <span>{date}</span>
      {item.source ? (
        <>
          <span className="text-muted">·</span>
          <MarketSourceLogo
            label={item.source}
            sourceId={normalizeMarketSource(item.source)}
            variant="compact"
          />
        </>
      ) : null}
    </span>
  );
}

function EvidenceRow({
  label,
  item,
  viewUrl,
}: {
  label: string;
  item: MarketEvidence | null;
  viewUrl: string | null;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-primary">
        <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0.5">
          <EvidenceMeta item={item} />
          {viewUrl ? (
            <a
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[10px] font-medium text-accent underline-offset-2 hover:underline"
            >
              View
            </a>
          ) : null}
        </span>
      </dd>
    </div>
  );
}

function GradeHighlightBlock({
  title,
  row,
  ebayHub,
  hubMap,
}: {
  title: string;
  row: GradeHighlight;
  ebayHub: EbayGradeHub;
  hubMap: ReturnType<typeof buildHubUrlMap>;
}) {
  return (
    <div className="min-w-[14rem] shrink-0 rounded-lg border border-border-subtle bg-panel-raised/40 p-2.5 lg:min-w-0">
      <p className="text-[11px] font-medium text-primary">{title}</p>
      <p className="mt-1 font-mono text-sm text-accent">{fmtUsd(row.fmvUsd)}</p>
      {row.fmvBasis ? (
        <p className="text-[10px] text-faint">FMV · {formatFmvBasis(row.fmvBasis)}</p>
      ) : null}
      <dl className="mt-2 space-y-1 text-[10px]">
        {/*
          Prefer grade-scoped eBay hub URLs first. Index comps may be Cardmarket/TCGPlayer or raw eBay
          item/search URLs — resolveEvidenceExternalUrl would send users away from the PSA/BGS/CGC
          completed-listing searches that match the working “Recent sales & graded hubs” buttons.
        */}
        <EvidenceRow
          label="Latest sold"
          item={row.latestSold}
          viewUrl={
            ebayHub.sold?.trim() ||
            (row.latestSold
              ? resolveEvidenceExternalUrl(row.latestSold, hubMap, { ebayGradeHub: ebayHub })?.trim() ?? null
              : null) ||
            hubMap.get("ebay")?.sold?.trim() ||
            null
          }
        />
        <EvidenceRow
          label="Listed / ask"
          item={row.latestListed}
          viewUrl={
            ebayHub.active?.trim() ||
            (row.latestListed
              ? resolveEvidenceExternalUrl(row.latestListed, hubMap, { ebayGradeHub: ebayHub })?.trim() ?? null
              : null) ||
            hubMap.get("ebay")?.active?.trim() ||
            null
          }
        />
      </dl>
    </div>
  );
}

function MarketSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <details
        className="group rounded-xl border border-border-subtle bg-panel-raised/30 lg:hidden"
        open={defaultOpen}
      >
        <summary className="cursor-pointer list-none px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2 text-xs font-semibold text-primary">
            {title}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
          </span>
          {subtitle ? <span className="mt-0.5 block text-[10px] font-normal text-muted">{subtitle}</span> : null}
        </summary>
        <div className="border-t border-border-subtle/80 px-3 py-3">{children}</div>
      </details>
      <div className="hidden lg:block">
        <p className="text-[11px] font-medium text-primary">{title}</p>
        {subtitle ? <p className="mt-0.5 text-[10px] text-muted">{subtitle}</p> : null}
        <div className="mt-2">{children}</div>
      </div>
    </>
  );
}

function ComparisonStrip({ snapshot }: { snapshot: CatalogMarketSnapshot }) {
  const { raw, psa9, psa10, deltaRawToPsa9, deltaRawToPsa10, deltaPsa9ToPsa10 } = snapshot.gradeComparison;
  const cols = [
    { label: "Raw", row: raw, delta: null as number | null },
    { label: "PSA 9", row: psa9, delta: deltaRawToPsa9 },
    { label: "PSA 10", row: psa10, delta: deltaPsa9ToPsa10 },
  ];
  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5">
      {cols.map((col) => (
        <div
          key={col.label}
          className="rounded-lg border border-border-subtle bg-panel-raised/60 px-2 py-2 text-center"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{col.label}</p>
          <p className="mt-0.5 font-mono text-sm text-primary">{fmtUsd(col.row.fmvUsd)}</p>
          {col.label !== "Raw" && col.delta != null ? (
            <p className="mt-0.5 text-[10px] text-faint">vs prior {fmtDelta(col.delta)}</p>
          ) : null}
          {col.label === "Raw" && deltaRawToPsa10 != null ? (
            <p className="mt-0.5 text-[10px] text-faint">→ PSA 10 {fmtDelta(deltaRawToPsa10)}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PokedexCardMarketPanel({
  cardId,
  printingHint,
}: {
  cardId: string;
  /** Biases marketplace hub URLs / searches (vintage print runs). */
  printingHint?: string | null;
}) {
  const [data, setData] = useState<MarketPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (refresh = false) => {
      setLoading(true);
      setError(null);
      const q = refresh ? "&refresh=1" : "";
      const ph = printingHint?.trim()
        ? `&printing=${encodeURIComponent(printingHint.trim())}`
        : "";
      return fetch(`/api/pokedex/market?id=${encodeURIComponent(cardId)}${q}${ph}`)
        .then(async (r) => {
          const body = (await r.json().catch(() => ({}))) as MarketPayload & { error?: string };
          if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
          return body;
        })
        .then((payload) => {
          setData(payload);
        })
        .catch((e: unknown) => {
          setError(e instanceof Error ? e.message : "Failed to load market data");
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [cardId, printingHint],
  );

  useEffect(() => {
    let cancelled = false;
    void load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const snapshot = data?.snapshot;
  const hubLinks = useMemo(() => data?.marketSourceLinks ?? [], [data?.marketSourceLinks]);
  const ebayGradeHubs = data?.ebayGradeHubs;
  const hubMap = useMemo(() => buildHubUrlMap(hubLinks), [hubLinks]);

  const resolveCompUrl = useCallback(
    (item: MarketEvidence | null) => {
      if (!item) return null;
      const gradeKey = slabToEbayGradeKey(item.slab);
      const ebayHub = ebayGradeHubs?.[gradeKey];
      return resolveEvidenceExternalUrl(item, hubMap, ebayHub ? { ebayGradeHub: ebayHub } : undefined);
    },
    [hubMap, ebayGradeHubs],
  );

  return (
    <section className="mt-5 border-t border-border-subtle pt-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">Market reference</h4>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[10px] text-muted"
          disabled={loading}
          onClick={() => void load(true)}
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </div>
      {loading && !snapshot ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Fetching live comps…
        </div>
      ) : error ? (
        <p className="mt-3 text-xs text-danger">{error}</p>
      ) : snapshot ? (
        <div className="mt-4 space-y-3 lg:space-y-4">
          <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-3">
            <p className="text-[11px] font-medium text-primary">Fair market value (raw)</p>
            <p className="mt-0.5 font-mono text-2xl text-accent lg:text-lg">{fmtUsd(snapshot.fairValueUsd)}</p>
            {snapshot.fairValueBasis ? (
              <p className="text-[10px] text-faint">Basis: {formatFmvBasis(snapshot.fairValueBasis)}</p>
            ) : null}
          </div>

          <div>
            <p className="text-[11px] font-medium text-primary">Raw vs PSA 9 vs PSA 10</p>
            <ComparisonStrip snapshot={snapshot} />
          </div>

          <MarketSection title="Latest raw market" defaultOpen>
            <div className="space-y-1.5 rounded-lg border border-border-subtle bg-panel-raised/40 p-2.5 text-[10px]">
              <EvidenceRow
                label="Latest sold"
                item={snapshot.rawHighlight.latestSold}
                viewUrl={
                  resolveCompUrl(snapshot.rawHighlight.latestSold) ?? ebayGradeHubs?.raw.sold ?? null
                }
              />
              <EvidenceRow
                label="Listed / ask"
                item={snapshot.rawHighlight.latestListed}
                viewUrl={
                  resolveCompUrl(snapshot.rawHighlight.latestListed) ?? ebayGradeHubs?.raw.active ?? null
                }
              />
            </div>
          </MarketSection>

          <MarketSection title="Graded highlights" subtitle="PSA 10, BGS BL, CGC 10">
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-1 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
              {ebayGradeHubs ? (
                <>
                  <GradeHighlightBlock
                    title="PSA 10"
                    row={snapshot.highlights.psa10}
                    ebayHub={ebayGradeHubs.psa10}
                    hubMap={hubMap}
                  />
                  <GradeHighlightBlock
                    title="BGS Black Label"
                    row={snapshot.highlights.bgsBlackLabel}
                    ebayHub={ebayGradeHubs.bgsBlackLabel}
                    hubMap={hubMap}
                  />
                  <GradeHighlightBlock
                    title="CGC 10"
                    row={snapshot.highlights.cgcPristine10}
                    ebayHub={ebayGradeHubs.cgcPristine10}
                    hubMap={hubMap}
                  />
                </>
              ) : (
                <>
                  <GradeHighlightBlock title="PSA 10" row={snapshot.highlights.psa10} ebayHub={{ sold: "", active: "" }} hubMap={hubMap} />
                  <GradeHighlightBlock title="BGS Black Label" row={snapshot.highlights.bgsBlackLabel} ebayHub={{ sold: "", active: "" }} hubMap={hubMap} />
                  <GradeHighlightBlock title="CGC 10" row={snapshot.highlights.cgcPristine10} ebayHub={{ sold: "", active: "" }} hubMap={hubMap} />
                </>
              )}
            </div>
          </MarketSection>

          {snapshot.recentListings.length > 0 ? (
            <MarketSection title="Live listings & asks" subtitle={`${snapshot.recentListings.length} active`}>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto text-[10px]">
                {snapshot.recentListings.map((item, i) => (
                  <li
                    key={`list-${item.url ?? item.title}-${i}`}
                    className="rounded-md border border-border-subtle/80 bg-panel-raised/40 px-2 py-1.5"
                  >
                    <p className="line-clamp-2 text-primary">{item.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-muted">
                      <span>{fmtUsd(item.priceUsd)}</span>
                      {item.slab ? (
                        <>
                          <span>·</span>
                          <span>{item.slab}</span>
                        </>
                      ) : null}
                      {item.source ? (
                        <>
                          <span>·</span>
                          <MarketSourceLogo
                            label={item.source}
                            sourceId={normalizeMarketSource(item.source)}
                            variant="compact"
                          />
                        </>
                      ) : null}
                    </div>
                    {(() => {
                      const href = resolveCompUrl(item) ?? item.url;
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-block text-accent underline-offset-2 hover:underline"
                        >
                          View listing
                        </a>
                      ) : null;
                    })()}
                  </li>
                ))}
              </ul>
            </MarketSection>
          ) : null}

          {snapshot.recentSales.length > 0 ? (
            <MarketSection title="Recent sold comps" subtitle={`${snapshot.recentSales.length} sales`}>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto text-[10px]">
                {snapshot.recentSales.map((item, i) => (
                  <li
                    key={`${item.url ?? item.title}-${i}`}
                    className="rounded-md border border-border-subtle/80 bg-panel-raised/40 px-2 py-1.5"
                  >
                    <p className="line-clamp-2 text-primary">{item.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-muted">
                      <span>{fmtUsd(item.priceUsd)}</span>
                      {item.slab ? (
                        <>
                          <span>·</span>
                          <span>{item.slab}</span>
                        </>
                      ) : null}
                      {item.observedAt ? (
                        <>
                          <span>·</span>
                          <span>{new Date(item.observedAt).toLocaleDateString()}</span>
                        </>
                      ) : null}
                      {item.source ? (
                        <>
                          <span>·</span>
                          <MarketSourceLogo
                            label={item.source}
                            sourceId={normalizeMarketSource(item.source)}
                            variant="compact"
                          />
                        </>
                      ) : null}
                    </div>
                    {(() => {
                      const href = resolveCompUrl(item) ?? item.url;
                      return href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-block text-accent underline-offset-2 hover:underline"
                        >
                          View listing
                        </a>
                      ) : null;
                    })()}
                  </li>
                ))}
              </ul>
            </MarketSection>
          ) : null}

          {snapshot.tcgVariants.length > 0 ? (
            <MarketSection title="TCGPlayer catalog (by print)">
              {snapshot.tcgPlayerUpdatedAt ? (
                <p className="mt-0.5 text-[10px] text-faint">Updated {snapshot.tcgPlayerUpdatedAt}</p>
              ) : null}
              <div className="mt-2 overflow-hidden rounded-lg border border-border-subtle">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-panel-raised/80 text-faint">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">Variant</th>
                      <th className="px-2 py-1.5 font-medium">Market</th>
                      <th className="px-2 py-1.5 font-medium">Low</th>
                      <th className="px-2 py-1.5 font-medium">Mid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-primary">
                    {snapshot.tcgVariants.map((row) => (
                      <tr key={row.variant}>
                        <td className="px-2 py-1.5">{labelTcgVariant(row.variant)}</td>
                        <td className="px-2 py-1.5 font-mono">{fmtUsd(row.market)}</td>
                        <td className="px-2 py-1.5 font-mono">{fmtUsd(row.low)}</td>
                        <td className="px-2 py-1.5 font-mono">{fmtUsd(row.mid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {snapshot.tcgPlayerUrl ? (
                <a
                  href={snapshot.tcgPlayerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-[10px] text-accent underline-offset-2 hover:underline"
                >
                  Open on TCGPlayer
                </a>
              ) : null}
            </MarketSection>
          ) : (
            <p className="text-[11px] text-muted">
              No TCGPlayer variant prices for this card.
              {snapshot.tcgPlayerUrl ? (
                <>
                  {" "}
                  <a
                    href={snapshot.tcgPlayerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    Search TCGPlayer
                  </a>
                </>
              ) : null}
            </p>
          )}

          {snapshot.cardMarket ? (
            <MarketSection title="Cardmarket trend">
              {snapshot.cardMarketUpdatedAt ? (
                <p className="mt-0.5 text-[10px] text-faint">Updated {snapshot.cardMarketUpdatedAt}</p>
              ) : null}
              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                <div className="flex justify-between gap-2 rounded-md bg-panel-raised/50 px-2 py-1">
                  <dt className="text-muted">Trend</dt>
                  <dd className="font-mono text-primary">{fmtUsd(snapshot.cardMarket.trendPrice)}</dd>
                </div>
                <div className="flex justify-between gap-2 rounded-md bg-panel-raised/50 px-2 py-1">
                  <dt className="text-muted">7d avg</dt>
                  <dd className="font-mono text-primary">{fmtUsd(snapshot.cardMarket.avg7)}</dd>
                </div>
                <div className="flex justify-between gap-2 rounded-md bg-panel-raised/50 px-2 py-1">
                  <dt className="text-muted">30d avg</dt>
                  <dd className="font-mono text-primary">{fmtUsd(snapshot.cardMarket.avg30)}</dd>
                </div>
                <div className="flex justify-between gap-2 rounded-md bg-panel-raised/50 px-2 py-1">
                  <dt className="text-muted">Avg sell</dt>
                  <dd className="font-mono text-primary">{fmtUsd(snapshot.cardMarket.averageSellPrice)}</dd>
                </div>
              </dl>
            </MarketSection>
          ) : null}

          <MarketSection
            title="Marketplace hubs"
            subtitle="Sold & active searches"
            defaultOpen
          >
            <div className="flex flex-wrap gap-1.5">
              {hubLinks.map((l) => (
                <Button key={`${l.source}-${l.lane}`} size="sm" variant="secondary" asChild className="text-[11px]">
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.label}
                  </a>
                </Button>
              ))}
            </div>
          </MarketSection>

          {loading ? (
            <p className="flex items-center gap-1.5 text-[10px] text-muted">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Updating comps…
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
