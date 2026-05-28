"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { marketPokemonHref } from "@/lib/app-routes";
import type { FairValueBasis } from "@/lib/market/fair-value";
import {
  gradeBucketLabel,
  type GradeBucket,
  type GradeBucketSummary,
} from "@/lib/market/market-intelligence";
import type { PokemonMarketKnowledge } from "@/lib/market/pokemon-market-knowledge";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { cn } from "@/lib/cn";

const LADDER_BUCKETS: GradeBucket[] = ["raw", "psa9", "psa10", "bgsBlackLabel", "cgcPristine10"];

const FMV_BASIS_PHRASE: Partial<Record<FairValueBasis, string>> = {
  sold_median: "recent sold median",
  active_median: "active listing median",
  reference_median: "price guide median",
  sticker_anchor: "sticker price",
  tcg_catalog: "TCGPlayer market price",
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function formatFmvBasis(basis: FairValueBasis | null): string {
  if (!basis) return "insufficient comps";
  return FMV_BASIS_PHRASE[basis] ?? basis.replace(/_/g, " ");
}

function formatObserved(at: string | null): string {
  if (!at) return "—";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

function sortCompsForDisplay(comps: CatalogMarketIntel["comps"], limit: number) {
  const kindOrder = (k: string) => (k === "sold" ? 0 : k === "active" ? 1 : 2);
  return [...comps]
    .sort((a, b) => {
      const ko = kindOrder(a.kind) - kindOrder(b.kind);
      if (ko !== 0) return ko;
      const ta = a.observedAt ? Date.parse(a.observedAt) : 0;
      const tb = b.observedAt ? Date.parse(b.observedAt) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}

function FmvBand({
  knowledge,
  isSheet,
  onRefresh,
  refreshing,
  needsLive,
  catalogId,
}: {
  knowledge: PokemonMarketKnowledge;
  isSheet: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  needsLive: boolean;
  catalogId: string;
}) {
  return (
    <div className="sc-catalog-fmv-band rounded-xl border border-accent/30 bg-gradient-to-r from-accent/[0.12] via-panel-raised/50 to-panel-raised/30">
      <div className="flex items-stretch gap-2 p-2.5 sm:gap-3 sm:p-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-faint">
            Fair market value
          </p>
          <p
            className={cn(
              "font-mono font-semibold leading-none tracking-tight text-accent",
              isSheet ? "mt-0.5 text-[1.75rem] sm:text-[1.625rem]" : "mt-1 text-3xl",
            )}
          >
            {fmtUsd(knowledge.fairValueUsd)}
          </p>
          <p className="mt-0.5 text-[10px] text-muted">{formatFmvBasis(knowledge.fairValueBasis)}</p>
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
          : "Building memory — live refresh may run"}
      </p>
    </div>
  );
}

export function CatalogCardMarketIntelPanel({
  catalogId,
  variant = "sheet",
  autoRefreshWhenThin = true,
  className,
}: {
  catalogId: string;
  variant?: "sheet" | "full";
  autoRefreshWhenThin?: boolean;
  className?: string;
}) {
  const isSheet = variant === "sheet";
  const [knowledge, setKnowledge] = useState<PokemonMarketKnowledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRefreshAttempted = useRef(false);

  const loadIntel = useCallback(async () => {
    const id = catalogId.trim();
    if (!id) return null;
    const res = await fetch(`/api/market/intel?catalogId=${encodeURIComponent(id)}`);
    const body = (await res.json()) as PokemonMarketKnowledge & { ready?: boolean; error?: string };
    if (!res.ok || !body.ready) {
      throw new Error(body.error ?? `Market intel failed (${res.status})`);
    }
    return body;
  }, [catalogId]);

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
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadIntel()
      .then((data) => {
        if (!cancelled && data) setKnowledge(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load market intel");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadIntel]);

  useEffect(() => {
    if (!autoRefreshWhenThin || !knowledge || autoRefreshAttempted.current) return;
    const thin =
      !knowledge.institutionalMemory || knowledge.dataDepth.persistedComps < 6;
    if (!thin) return;
    autoRefreshAttempted.current = true;
    void refreshLive(false);
  }, [autoRefreshWhenThin, knowledge, refreshLive]);

  const ladderRows = useMemo(() => {
    if (!knowledge) return [];
    const byBucket = new Map(knowledge.intelligence.buckets.map((b) => [b.bucket, b]));
    return LADDER_BUCKETS.map((bucket) => byBucket.get(bucket)).filter(
      (row): row is GradeBucketSummary =>
        Boolean(row && row.soldCount + row.activeCount + row.referenceCount > 0),
    );
  }, [knowledge]);

  const displayComps = useMemo(() => {
    const comps = knowledge?.intel?.comps ?? [];
    return sortCompsForDisplay(comps, isSheet ? 5 : 10);
  }, [knowledge?.intel?.comps, isSheet]);

  const needsLive =
    knowledge != null &&
    (!knowledge.institutionalMemory || knowledge.dataDepth.persistedComps < 6);

  if (loading && !knowledge) {
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
        <Button type="button" size="sm" variant="secondary" onClick={() => void loadIntel()}>
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

      <FmvBand
        knowledge={knowledge}
        isSheet={isSheet}
        catalogId={catalogId}
        refreshing={refreshing}
        needsLive={needsLive}
        onRefresh={() => void refreshLive(needsLive)}
      />

      {ladderRows.length > 0 ? (
        <div className="sc-catalog-grade-ladder flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {ladderRows.slice(0, isSheet ? 3 : 5).map((row) => (
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
      ) : null}

      {displayComps.length > 0 ? (
        <div className="sc-catalog-comps-list">
          <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-faint">
            Recent comps
          </p>
          <ul className="divide-y divide-border-subtle/50 rounded-lg border border-border-subtle/70 bg-panel-raised/20">
            {displayComps.map((row) => (
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
                    {row.gradeBucket ? (
                      <span className="text-[8px] text-faint">
                        {gradeBucketLabel(row.gradeBucket as GradeBucket)}
                      </span>
                    ) : null}
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
      ) : (
        <p className="text-[10px] text-muted">No comps yet — tap refresh on FMV.</p>
      )}

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
