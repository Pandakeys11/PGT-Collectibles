"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketSourceLogo } from "@/components/market/market-source-logo";
import { normalizeMarketSource } from "@/lib/market/sources";
import { marketPokemonHref } from "@/lib/app-routes";
import { MarketLaneCompGrid } from "@/components/market/market-lane-comp-grid";
import { buildCatalogLaneCompSummaries } from "@/lib/market/catalog-knowledge-lane-summary";
import {
  resolveCatalogGradedGuide,
  resolvePriceChartingGradedTiers,
} from "@/lib/market/catalog-graded-guide";
import {
  fetchCatalogMarketIntel,
  writeCachedCatalogIntel,
} from "@/lib/market/catalog-intel-client";
import { resolveEvidenceGradeBucket } from "@/lib/market/catalog-raw-fmv";
import {
  formatFmvBasis,
  formatFmvUsd,
  knowledgeFromRawFmvSeed,
  type CatalogRawFmvSeed,
} from "@/lib/market/fmv-display";
import {
  gradeBucketLabel,
  type GradeBucket,
  type GradeBucketSummary,
} from "@/lib/market/market-intelligence";
import { filterMarketEvidenceForCardIdentity } from "@/lib/market/market-evidence-identity";
import {
  catalogSummaryToExtractedCard,
  type PokemonMarketKnowledge,
} from "@/lib/market/pokemon-market-knowledge-shared";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import type { MarketEvidence } from "@/lib/scan/schemas";
import { cn } from "@/lib/cn";

type IntelCompRow = CatalogMarketIntel["comps"][number];

function intelCompToEvidence(row: IntelCompRow): MarketEvidence {
  return {
    kind: row.kind as MarketEvidence["kind"],
    title: row.title,
    priceUsd: row.priceUsd,
    observedAt: row.observedAt,
    url: row.url,
    source: row.source,
    slab: row.slab,
    gradeBucket: (row.gradeBucket as MarketEvidence["gradeBucket"] | null) ?? undefined,
  };
}

function compLaneLabel(row: IntelCompRow): string {
  return gradeBucketLabel(resolveEvidenceGradeBucket(intelCompToEvidence(row)));
}

const GRADED_LADDER_BUCKETS: GradeBucket[] = [
  "psa9",
  "psa10",
  "bgsBlackLabel",
  "cgcPristine10",
];

function fmtUsd(n: number | null | undefined): string {
  return formatFmvUsd(n);
}

function labelTcgVariant(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function confidenceClass(label: PokemonMarketKnowledge["intelligence"]["confidenceLabel"]): string {
  if (label === "high") return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
  if (label === "medium") return "border-amber-400/40 bg-amber-500/15 text-amber-100";
  if (label === "low") return "border-orange-400/35 bg-orange-500/12 text-orange-100";
  return "border-border-subtle bg-panel-raised/50 text-muted";
}

function kindBadge(kind: string): string {
  if (kind === "sold") return "bg-emerald-500/20 text-emerald-100";
  if (kind === "active") return "bg-sky-500/20 text-sky-100";
  return "bg-violet-500/15 text-violet-100";
}

function isPriceChartingSoldRow(source: string | null, kind: string): boolean {
  return kind === "sold" && /pricecharting/i.test(source ?? "");
}

function sortCompsForDisplay(comps: CatalogMarketIntel["comps"], limit: number) {
  const kindOrder = (k: string) => (k === "sold" ? 0 : k === "active" ? 1 : 2);
  const sourceOrder = (source: string | null, kind: string) => {
    if (isPriceChartingSoldRow(source, kind)) return 0;
    if (kind === "sold" && /ebay/i.test(source ?? "")) return 1;
    return 2;
  };
  return [...comps]
    .sort((a, b) => {
      const so = sourceOrder(a.source, a.kind) - sourceOrder(b.source, b.kind);
      if (so !== 0) return so;
      const ko = kindOrder(a.kind) - kindOrder(b.kind);
      if (ko !== 0) return ko;
      const ta = a.observedAt ? Date.parse(a.observedAt) : 0;
      const tb = b.observedAt ? Date.parse(b.observedAt) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

function RawFmvBand({
  knowledge,
  isSheet,
  onRefresh,
  refreshing,
  needsLive,
  catalogId,
  hydrating = false,
}: {
  knowledge: PokemonMarketKnowledge;
  isSheet: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  needsLive: boolean;
  catalogId: string;
  /** Full intel still loading — Raw FMV from catalog prices is already shown. */
  hydrating?: boolean;
}) {
  const headline = knowledge.rawFmvUsd;
  const basis = knowledge.rawFmvBasis;

  return (
    <div className="sc-catalog-fmv-band rounded-xl border border-accent/30 bg-gradient-to-r from-accent/[0.12] via-panel-raised/50 to-panel-raised/30">
      <div className="flex items-stretch gap-2 p-2.5 sm:gap-3 sm:p-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
            Raw FMV
          </p>
          <p
            className={cn(
              "font-mono font-semibold leading-none tracking-tight text-accent",
              isSheet ? "mt-0.5 text-[1.75rem] sm:text-[1.625rem]" : "mt-1 text-3xl",
            )}
          >
            {fmtUsd(headline)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">
            {formatFmvBasis(basis)} · {knowledge.rawFmvSourceLabel}
            {hydrating ? (
              <span className="text-faint"> · loading comps…</span>
            ) : null}
          </p>
          {(knowledge.tcgPlayerUsd != null ||
            knowledge.priceChartingUsd != null ||
            knowledge.referencePrices.priceChartingPsa10Usd != null ||
            knowledge.referencePrices.priceChartingPsa9Usd != null ||
            knowledge.referencePrices.priceChartingPsa8Usd != null) && (
            <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-faint">
              {knowledge.tcgPlayerUsd != null ? (
                <span className="inline-flex items-center gap-1">
                  <MarketSourceLogo label="TCGPlayer" hideLaneChips />
                  {fmtUsd(knowledge.tcgPlayerUsd)}
                </span>
              ) : null}
              {knowledge.priceChartingUsd != null ? (
                <span className="inline-flex items-center gap-1" title="PriceCharting loose">
                  <MarketSourceLogo label="PriceCharting" hideLaneChips />
                  Loose {fmtUsd(knowledge.priceChartingUsd)}
                </span>
              ) : null}
              {knowledge.referencePrices.priceChartingPsa10Usd != null ? (
                <span className="inline-flex items-center gap-1" title="PriceCharting PSA 10 guide">
                  <MarketSourceLogo label="PriceCharting" hideLaneChips />
                  PSA 10 {fmtUsd(knowledge.referencePrices.priceChartingPsa10Usd)}
                </span>
              ) : null}
              {knowledge.referencePrices.priceChartingPsa9Usd != null ? (
                <span className="inline-flex items-center gap-1" title="PriceCharting PSA 9 guide">
                  <MarketSourceLogo label="PriceCharting" hideLaneChips />
                  PSA 9 {fmtUsd(knowledge.referencePrices.priceChartingPsa9Usd)}
                </span>
              ) : null}
              {knowledge.referencePrices.priceChartingPsa8Usd != null ? (
                <span className="inline-flex items-center gap-1" title="PriceCharting PSA 8 guide">
                  <MarketSourceLogo label="PriceCharting" hideLaneChips />
                  PSA 8 {fmtUsd(knowledge.referencePrices.priceChartingPsa8Usd)}
                </span>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between gap-1.5">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide",
              confidenceClass(knowledge.intelligence.confidenceLabel),
            )}
          >
            {knowledge.intelligence.confidenceLabel}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-[9px] text-muted"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} aria-hidden />
              <span className="sr-only sm:not-sr-only sm:ml-1">
                {needsLive ? "Live" : "Refresh"}
              </span>
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[9px]" asChild>
              <Link href={marketPokemonHref(catalogId)} title="Full market page">
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <p className="border-t border-accent/15 px-2.5 py-1 text-[9px] text-faint sm:px-3">
        {knowledge.institutionalMemory
          ? `${knowledge.dataDepth.persistedComps} comps · ${knowledge.dataDepth.populationSnapshots} pop`
          : "Building memory — live refresh pulls TCGPlayer, PriceCharting, and sold comps"}
      </p>
    </div>
  );
}

export function CatalogCardMarketIntelPanel({
  catalogId,
  variant = "sheet",
  autoRefreshWhenThin = true,
  initialRawFmv,
  className,
}: {
  catalogId: string;
  variant?: "sheet" | "full";
  autoRefreshWhenThin?: boolean;
  /** Instant Raw FMV from grid / catalog row while intel hydrates. */
  initialRawFmv?: CatalogRawFmvSeed | null;
  className?: string;
}) {
  const isSheet = variant === "sheet";
  const [knowledge, setKnowledge] = useState<PokemonMarketKnowledge | null>(() => {
    const id = catalogId.trim();
    if (!id || !initialRawFmv) return null;
    return knowledgeFromRawFmvSeed(id, initialRawFmv);
  });
  const [loadingFull, setLoadingFull] = useState(() => !initialRawFmv?.rawFmvUsd);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshAttempted = useRef(false);

  useEffect(() => {
    const id = catalogId.trim();
    if (!id) return;
    if (initialRawFmv) {
      setKnowledge(knowledgeFromRawFmvSeed(id, initialRawFmv));
      setLoadingFull(true);
      setError(null);
    } else {
      setKnowledge(null);
      setLoadingFull(true);
    }
    autoRefreshAttempted.current = false;
  }, [catalogId, initialRawFmv]);

  const refreshLive = useCallback(
    async (force = false) => {
      const id = catalogId.trim();
      if (!id) return;
      setRefreshing(true);
      setError(null);
      try {
        const res = await fetch("/api/market/intel/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalogId: id, force }),
        });
        const body = (await res.json()) as PokemonMarketKnowledge & { ready?: boolean; error?: string };
        if (!res.ok || !body.ready) {
          throw new Error(body.error ?? "Refresh failed");
        }
        writeCachedCatalogIntel(id, body, false);
        setKnowledge(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Refresh failed");
      } finally {
        setRefreshing(false);
      }
    },
    [catalogId],
  );

  useEffect(() => {
    const id = catalogId.trim();
    if (!id) return;

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      setError(null);
      try {
        // Fetch in parallel so the UI can paint with persisted comps quickly,
        // while full intel replaces it as soon as ready.
        const litePromise = fetchCatalogMarketIntel(id, {
          lite: true,
          signal: controller.signal,
        })
          .then((lite) => {
            if (!cancelled) setKnowledge(lite);
          })
          .catch(() => {
            // Keep whatever we already have (seed or partial) if lite fails.
          });

        const full = await fetchCatalogMarketIntel(id, {
          lite: false,
          signal: controller.signal,
        });
        if (!cancelled) setKnowledge(full);
        await litePromise;
      } catch (e: unknown) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        // If full fails but seed exists, we still want to keep rendering.
        setError((prev) => prev ?? (e instanceof Error ? e.message : "Failed to load market intel"));
      } finally {
        if (!cancelled) setLoadingFull(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [catalogId, initialRawFmv]);

  useEffect(() => {
    if (!autoRefreshWhenThin || !knowledge || loadingFull || autoRefreshAttempted.current) {
      return;
    }
    const thin =
      !knowledge.institutionalMemory || knowledge.dataDepth.persistedComps < 6;
    if (!thin) return;
    autoRefreshAttempted.current = true;
    const timer = window.setTimeout(() => void refreshLive(false), 800);
    return () => window.clearTimeout(timer);
  }, [autoRefreshWhenThin, knowledge, loadingFull, refreshLive]);

  const gradedGuide = useMemo(
    () => resolveCatalogGradedGuide(knowledge?.referencePrices, knowledge?.intel),
    [knowledge?.referencePrices, knowledge?.intel],
  );

  const priceChartingGradedTiers = useMemo(
    () => resolvePriceChartingGradedTiers(knowledge?.referencePrices),
    [knowledge?.referencePrices],
  );

  const identityFilteredComps = useMemo(() => {
    const comps = knowledge?.intel?.comps ?? [];
    if (!knowledge?.card) return comps;
    const extracted = catalogSummaryToExtractedCard({
      name: knowledge.card.name,
      number: knowledge.card.number,
      rarity: knowledge.card.rarity,
      set: knowledge.card.setName
        ? { id: knowledge.card.setCode ?? "", name: knowledge.card.setName }
        : undefined,
    });
    const evidence = comps.map((c) => ({
      kind: c.kind as "sold" | "active" | "reference",
      title: c.title,
      priceUsd: c.priceUsd,
      observedAt: c.observedAt,
      url: c.url,
      source: c.source,
      slab: c.slab,
      gradeBucket: (c.gradeBucket as MarketEvidence["gradeBucket"] | null) ?? undefined,
    }));
    const matched = filterMarketEvidenceForCardIdentity(evidence, extracted);
    const matchedTitles = new Set(matched.map((m) => m.title));
    const filtered = comps.filter((c) => matchedTitles.has(c.title));
    return filtered.length ? filtered : comps;
  }, [knowledge]);

  const laneCompSummaries = useMemo(() => {
    const seen = new Set<string>();
    const evidence: MarketEvidence[] = [];
    const push = (row: MarketEvidence) => {
      const key = `${row.kind}|${row.title}|${row.priceUsd ?? ""}|${row.observedAt ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      evidence.push(row);
    };
    for (const c of identityFilteredComps) push(intelCompToEvidence(c));
    for (const row of knowledge?.marketEvidence ?? []) push(row);
    return buildCatalogLaneCompSummaries(evidence);
  }, [identityFilteredComps, knowledge?.marketEvidence]);

  const gradedLadderRows = useMemo(() => {
    const fromLanes: GradeBucketSummary[] = laneCompSummaries
      .filter((row) => row.bucket !== "raw")
      .map((row) => {
        const sold =
          row.soldDisplay === "—"
            ? null
            : Number(row.soldDisplay.replace(/[^0-9.]/g, "")) || null;
        const active =
          row.listedDisplay === "—"
            ? null
            : Number(row.listedDisplay.replace(/[^0-9.]/g, "")) || null;
        return {
          bucket: row.bucket,
          label: row.label,
          soldCount: row.soldCount,
          activeCount: row.activeCount,
          referenceCount: 0,
          medianSoldUsd: sold,
          medianActiveUsd: active,
          latestSoldUsd: sold,
          latestSoldAt: null,
          lowSoldUsd: null,
          highSoldUsd: null,
          sources: [],
        };
      })
      .filter((row) => GRADED_LADDER_BUCKETS.includes(row.bucket as GradeBucket));

    if (fromLanes.length > 0) {
      return GRADED_LADDER_BUCKETS.map((bucket) =>
        fromLanes.find((r) => r.bucket === bucket),
      ).filter((row): row is GradeBucketSummary => Boolean(row));
    }

    if (!knowledge) return [];
    const byBucket = new Map(knowledge.intelligence.buckets.map((b) => [b.bucket, b]));
    return GRADED_LADDER_BUCKETS.map((bucket) => byBucket.get(bucket)).filter(
      (row): row is GradeBucketSummary =>
        Boolean(row && row.soldCount + row.activeCount + row.referenceCount > 0),
    );
  }, [knowledge, laneCompSummaries]);

  const priceChartingSoldComps = useMemo(() => {
    return sortCompsForDisplay(
      identityFilteredComps.filter((c) => isPriceChartingSoldRow(c.source, c.kind)),
      isSheet ? 6 : 10,
    );
  }, [identityFilteredComps, isSheet]);

  const { rawMarketComps, gradedMarketComps } = useMemo(() => {
    const raw: IntelCompRow[] = [];
    const graded: IntelCompRow[] = [];
    for (const row of identityFilteredComps) {
      if (isPriceChartingSoldRow(row.source, row.kind)) continue;
      const bucket = resolveEvidenceGradeBucket(intelCompToEvidence(row));
      if (bucket === "raw") raw.push(row);
      else graded.push(row);
    }
    return {
      rawMarketComps: sortCompsForDisplay(raw, isSheet ? 8 : 12),
      gradedMarketComps: sortCompsForDisplay(graded, isSheet ? 10 : 14),
    };
  }, [identityFilteredComps, isSheet]);

  const certifications = knowledge?.intel?.certifications ?? [];

  const referencePrices = knowledge?.referencePrices;
  const needsLive =
    knowledge != null &&
    (!knowledge.institutionalMemory || knowledge.dataDepth.persistedComps < 6);

  if (!knowledge && loadingFull) {
    return (
      <div className={cn("flex items-center gap-2 py-2 text-xs text-muted", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Loading market…
      </div>
    );
  }

  if (error && !knowledge) {
    return (
      <div className={cn("space-y-2 py-2", className)}>
        <p className="text-xs text-danger">{error}</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setLoadingFull(true);
            void fetchCatalogMarketIntel(catalogId.trim())
              .then(setKnowledge)
              .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : "Failed to load market intel"),
              )
              .finally(() => setLoadingFull(false));
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!knowledge) return null;

  return (
    <section className={cn("sc-catalog-market-intel space-y-2", className)}>
      {!isSheet ? (
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[10px] font-semibold uppercase tracking-wide text-faint">
            Market intel
          </h4>
        </div>
      ) : null}

      <RawFmvBand
        knowledge={knowledge}
        isSheet={isSheet}
        catalogId={catalogId}
        refreshing={refreshing}
        needsLive={needsLive}
        hydrating={loadingFull}
        onRefresh={() => void refreshLive(needsLive)}
      />

      <MarketLaneCompGrid lanes={laneCompSummaries} />

      {referencePrices && referencePrices.tcgPlayerPrices.length > 0 ? (
        <div className="rounded-lg border border-border-subtle/70 bg-panel-raised/25 p-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">
            TCGPlayer reference
          </p>
          <div className="mt-1.5 overflow-x-auto">
            <table className="w-full min-w-[14rem] text-left text-[10px]">
              <thead>
                <tr className="border-b border-border-subtle/60 text-faint">
                  <th className="pb-1 pr-2 font-medium">Variant</th>
                  <th className="pb-1 pr-2 font-medium">Market</th>
                  <th className="pb-1 font-medium">Low</th>
                </tr>
              </thead>
              <tbody>
                {referencePrices.tcgPlayerPrices.slice(0, isSheet ? 4 : 8).map((row) => (
                  <tr key={row.variant} className="border-b border-border-subtle/30 last:border-0">
                    <td className="py-1 pr-2 text-primary">{labelTcgVariant(row.variant)}</td>
                    <td className="py-1 pr-2 font-mono text-accent">
                      {fmtUsd(row.market ?? row.mid)}
                    </td>
                    <td className="py-1 font-mono text-muted">{fmtUsd(row.low)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {gradedLadderRows.length > 0 ? (
        <div>
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">
            Graded FMV · sold / listed comps
          </p>
          <div className="sc-catalog-grade-ladder flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {gradedLadderRows.slice(0, isSheet ? 3 : 5).map((row) => (
              <div
                key={row.bucket}
                className="min-w-[4.5rem] shrink-0 rounded-lg border border-border-subtle/80 bg-panel-raised/40 px-2 py-1.5 text-center sm:min-w-0"
              >
                <p className="text-[8px] font-semibold uppercase tracking-wide text-muted">
                  {row.label}
                </p>
                <p className="font-mono text-sm leading-tight text-primary">
                  {fmtUsd(row.medianSoldUsd ?? row.medianActiveUsd)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {priceChartingGradedTiers.length > 0 ? (
        <div>
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200/85">
            PriceCharting graded (PSA 8–10)
          </p>
          <p className="mb-1.5 px-0.5 text-[9px] leading-snug text-muted">
            Cached grade guides from PriceCharting — PSA 10, grade 9 (CIB), and grade 8 (NM).
          </p>
          <div className="flex gap-1 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-3">
            {priceChartingGradedTiers.map((tier) => (
              <div
                key={tier.label}
                className="min-w-[4.25rem] shrink-0 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2 py-1.5 text-center"
              >
                <p className="text-[8px] font-semibold uppercase tracking-wide text-amber-200/90">
                  {tier.label}
                </p>
                <p className="font-mono text-sm leading-tight text-primary">{fmtUsd(tier.usd)}</p>
                <div className="mt-0.5 flex justify-center">
                  <MarketSourceLogo
                    label="PriceCharting"
                    sourceId="pricecharting"
                    variant="compact"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : gradedGuide.tiers.length > 0 ? (
        <div>
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">
            Graded guide (PSA 8–10)
          </p>
          <div className="flex gap-1 overflow-x-auto pb-0.5 sm:grid sm:grid-cols-3">
            {gradedGuide.tiers.map((tier) => (
              <div
                key={tier.label}
                className="min-w-[4.25rem] shrink-0 rounded-lg border border-violet-400/20 bg-violet-500/[0.08] px-2 py-1.5 text-center"
              >
                <p className="text-[8px] font-semibold uppercase tracking-wide text-violet-200/80">
                  {tier.label}
                </p>
                <p className="font-mono text-sm leading-tight text-primary">{fmtUsd(tier.usd)}</p>
                <div className="mt-0.5 flex justify-center">
                  <MarketSourceLogo
                    label={tier.source}
                    sourceId={normalizeMarketSource(tier.source)}
                    variant="compact"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {priceChartingSoldComps.length > 0 ? (
        <div className="sc-catalog-comps-list">
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200/80">
            PriceCharting recent solds
          </p>
          <p className="mb-1.5 px-0.5 text-[9px] leading-snug text-muted">
            Completed auctions from the PriceCharting product page — best last-sold coverage when eBay
            ingest is thin.
          </p>
          <ul className="divide-y divide-border-subtle/50 rounded-lg border border-amber-500/20 bg-amber-500/[0.04]">
            {priceChartingSoldComps.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="rounded bg-amber-500/20 px-1 py-px text-[7px] font-bold uppercase text-amber-100">
                      Sold
                    </span>
                    {row.source ? (
                      <MarketSourceLogo
                        label={row.source}
                        sourceId={normalizeMarketSource(row.source)}
                        variant="compact"
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-primary">
                    {row.title}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] font-medium text-accent">
                    {fmtUsd(row.priceUsd)}
                  </p>
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[8px] text-accent underline-offset-2 hover:underline"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rawMarketComps.length > 0 ? (
        <div className="sc-catalog-comps-list">
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/80">
            Raw market comps
          </p>
          <ul className="divide-y divide-border-subtle/50 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04]">
            {rawMarketComps.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={cn(
                        "rounded px-1 py-px text-[7px] font-bold uppercase",
                        kindBadge(row.kind),
                      )}
                    >
                      {row.kind}
                    </span>
                    {row.source ? (
                      <MarketSourceLogo
                        label={row.source}
                        sourceId={normalizeMarketSource(row.source)}
                        variant="compact"
                      />
                    ) : null}
                    <span className="text-[8px] font-medium text-emerald-200/90">
                      {compLaneLabel(row)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-primary">
                    {row.title}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] font-medium text-accent">
                    {fmtUsd(row.priceUsd)}
                  </p>
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[8px] text-accent underline-offset-2 hover:underline"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {gradedMarketComps.length > 0 ? (
        <div className="sc-catalog-comps-list">
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200/80">
            Graded market comps
          </p>
          <ul className="divide-y divide-border-subtle/50 rounded-lg border border-violet-500/20 bg-violet-500/[0.04]">
            {gradedMarketComps.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={cn(
                        "rounded px-1 py-px text-[7px] font-bold uppercase",
                        kindBadge(row.kind),
                      )}
                    >
                      {row.kind}
                    </span>
                    {row.source ? (
                      <MarketSourceLogo
                        label={row.source}
                        sourceId={normalizeMarketSource(row.source)}
                        variant="compact"
                      />
                    ) : null}
                    <span className="text-[8px] font-medium text-violet-200/90">
                      {compLaneLabel(row)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-primary">
                    {row.title}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] font-medium text-accent">
                    {fmtUsd(row.priceUsd)}
                  </p>
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[8px] text-accent underline-offset-2 hover:underline"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : rawMarketComps.length === 0 && priceChartingSoldComps.length === 0 ? (
        <p className="text-[10px] text-muted">No comps yet — tap refresh on Raw FMV.</p>
      ) : null}

      <div className="rounded-lg border border-border-subtle/70 bg-panel-raised/20 p-2">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">Population</p>
        <p className="mt-1 text-[10px] text-muted">Coming soon</p>
      </div>

      {certifications.length > 0 ? (
        <div className="rounded-lg border border-border-subtle/70 bg-panel-raised/20 p-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">Certs</p>
          <ul className="mt-1 space-y-1">
            {certifications.slice(0, isSheet ? 3 : 6).map((row) => (
              <li key={`${row.grader}-${row.certNumber}`} className="text-[10px] text-primary">
                {row.grader} {row.grade ?? ""} · #{row.certNumber}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-[10px] text-danger">{error}</p> : null}
      {refreshing ? (
        <p className="flex items-center gap-1.5 text-[10px] text-muted">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Updating live market…
        </p>
      ) : null}
    </section>
  );
}
