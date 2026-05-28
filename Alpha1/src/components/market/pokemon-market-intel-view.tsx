"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeft,
  Database,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { ScanThisCardButton } from "@/components/pokedex/scan-this-card-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { liquidScanHref, marketPokemonHref } from "@/lib/app-routes";
import type { FairValueBasis } from "@/lib/market/fair-value";
import {
  gradeBucketLabel,
  type GradeBucket,
  type GradeBucketSummary,
} from "@/lib/market/market-intelligence";
import type { PokemonMarketKnowledge } from "@/lib/market/pokemon-market-knowledge";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { cn } from "@/lib/cn";

const LADDER_BUCKETS: GradeBucket[] = [
  "raw",
  "psa9",
  "psa10",
  "bgsBlackLabel",
  "cgcPristine10",
];

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

function labelTcgVariant(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z0-9])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatObserved(at: string | null): string {
  if (!at) return "—";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

function GradeLadderCard({ row }: { row: GradeBucketSummary }) {
  const hasData = row.soldCount + row.activeCount + row.referenceCount > 0;
  if (!hasData) return null;

  return (
    <div className="min-w-[9.5rem] shrink-0 rounded-xl border border-border-subtle/80 bg-panel-raised/35 p-3 sm:min-w-0">
      <p className="text-[11px] font-semibold text-primary">{row.label}</p>
      <p className="mt-1 font-mono text-lg text-accent">{fmtUsd(row.medianSoldUsd ?? row.medianActiveUsd)}</p>
      <p className="text-[10px] text-faint">
        {row.soldCount > 0 ? `${row.soldCount} sold` : null}
        {row.soldCount > 0 && row.activeCount > 0 ? " · " : null}
        {row.activeCount > 0 ? `${row.activeCount} listed` : null}
        {row.soldCount === 0 && row.activeCount === 0 && row.referenceCount > 0
          ? `${row.referenceCount} ref`
          : null}
      </p>
      {row.latestSoldUsd != null ? (
        <p className="mt-1.5 text-[10px] text-muted">
          Latest {fmtUsd(row.latestSoldUsd)}
          {row.latestSoldAt ? ` · ${formatObserved(row.latestSoldAt)}` : null}
        </p>
      ) : null}
    </div>
  );
}

export function PokemonMarketIntelView({
  initial,
}: {
  initial: PokemonMarketKnowledge;
}) {
  const [knowledge, setKnowledge] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const card = knowledge.card;
  const { intelligence, referencePrices, intel } = knowledge;

  const scanPrefill = useMemo((): CatalogScanPrefill | null => {
    if (!card) return null;
    return {
      catalogId: knowledge.catalogId,
      name: card.name,
      franchise: "pokemon",
      set: card.setName ?? card.setCode ?? undefined,
      number: card.number ?? undefined,
      year: card.year ?? undefined,
      rarity: card.rarity ?? undefined,
      catalogImageUrl: card.imageLargeUrl ?? card.imageSmallUrl ?? undefined,
    };
  }, [card, knowledge.catalogId]);

  const ladderRows = useMemo(() => {
    const byBucket = new Map(intelligence.buckets.map((b) => [b.bucket, b]));
    return LADDER_BUCKETS.map((bucket) => byBucket.get(bucket)).filter(
      (row): row is GradeBucketSummary => Boolean(row),
    );
  }, [intelligence.buckets]);

  const comps = intel?.comps ?? [];
  const population = intel?.population ?? [];
  const certifications = intel?.certifications ?? [];

  const needsLive =
    !knowledge.institutionalMemory || knowledge.dataDepth.persistedComps < 6;

  const refresh = useCallback(
    async (force = false) => {
      setRefreshing(true);
      setRefreshError(null);
      try {
        const res = await fetch("/api/market/intel/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ catalogId: knowledge.catalogId, force }),
        });
        const data = (await res.json()) as PokemonMarketKnowledge & {
          ready?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ready) {
          setRefreshError(data.error ?? "Refresh failed");
          return;
        }
        setKnowledge(data);
      } catch {
        setRefreshError("Network error during refresh");
      } finally {
        setRefreshing(false);
      }
    },
    [knowledge.catalogId],
  );

  if (!card) return null;

  const heroImage = card.imageLargeUrl ?? card.imageSmallUrl;
  const subtitle = [card.setName, card.number ? `#${card.number}` : null, card.rarity]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link
          href={liquidScanHref("catalog")}
          className="inline-flex items-center gap-1 font-medium text-muted transition hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Master Catalog
        </Link>
        <span aria-hidden className="text-faint">
          /
        </span>
        <span className="truncate text-primary">{card.name}</span>
      </nav>

      <Card className="desk-surface-raised overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-6 sm:p-6">
          {heroImage ? (
            <div className="mx-auto w-[min(11rem,42vw)] shrink-0 sm:mx-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroImage}
                alt=""
                className="w-full rounded-xl border border-border-subtle/60 bg-panel-raised/30 object-contain shadow-sm"
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold leading-tight text-primary sm:text-2xl">
                  {card.name}
                </h1>
                {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
                <p className="mt-1 font-mono text-[11px] text-faint">{knowledge.catalogId}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  confidenceClass(intelligence.confidenceLabel),
                )}
              >
                {intelligence.confidenceLabel} confidence
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-faint">
                  Fair market value
                </p>
                <p className="font-mono text-3xl text-accent">{fmtUsd(knowledge.fairValueUsd)}</p>
                <p className="text-xs text-muted">
                  Based on {formatFmvBasis(knowledge.fairValueBasis)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
                    knowledge.institutionalMemory
                      ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                      : "border-amber-400/35 bg-amber-500/10 text-amber-100",
                  )}
                >
                  {knowledge.institutionalMemory ? (
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                  ) : (
                    <Database className="h-3 w-3" aria-hidden />
                  )}
                  {knowledge.institutionalMemory ? "Institutional memory" : "Building memory"}
                </span>
                <span className="rounded-full border border-border-subtle/80 bg-panel-raised/40 px-2 py-0.5 text-muted">
                  {knowledge.dataDepth.persistedComps} comps
                </span>
                <span className="rounded-full border border-border-subtle/80 bg-panel-raised/40 px-2 py-0.5 text-muted">
                  {knowledge.dataDepth.populationSnapshots} pop
                </span>
                <span className="rounded-full border border-border-subtle/80 bg-panel-raised/40 px-2 py-0.5 text-muted">
                  {knowledge.dataDepth.certifications} certs
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {scanPrefill ? <ScanThisCardButton prefill={scanPrefill} /> : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={refreshing}
                onClick={() => void refresh(needsLive)}
              >
                {refreshing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden />
                )}
                {needsLive ? "Refresh live market" : "Refresh market"}
              </Button>
              {referencePrices.tcgPlayerUrl ? (
                <Button size="sm" variant="secondary" asChild>
                  <a href={referencePrices.tcgPlayerUrl} target="_blank" rel="noreferrer">
                    TCGPlayer
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                  </a>
                </Button>
              ) : null}
            </div>
            {refreshError ? (
              <p className="mt-2 text-xs text-red-300" role="alert">
                {refreshError}
              </p>
            ) : null}
            {needsLive ? (
              <p className="mt-2 text-xs text-muted">
                Memory is still thin for this card — refresh runs live adapters and persists comps
                for the next visit.
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {ladderRows.some((r) => r.soldCount + r.activeCount + r.referenceCount > 0) ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-primary">Grade ladder</h2>
          <div className="flex gap-2 overflow-x-auto pb-1 scanner-chat-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3 xl:grid-cols-5">
            {ladderRows.map((row) => (
              <GradeLadderCard key={row.bucket} row={row} />
            ))}
          </div>
        </section>
      ) : null}

      {referencePrices.tcgPlayerPrices.length > 0 ? (
        <Card className="desk-surface-raised p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-primary">TCGPlayer reference</h2>
          {referencePrices.tcgPlayerUpdatedAt ? (
            <p className="mt-0.5 text-[10px] text-faint">
              Updated {formatObserved(referencePrices.tcgPlayerUpdatedAt)}
            </p>
          ) : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[16rem] text-left text-xs">
              <thead>
                <tr className="border-b border-border-subtle/70 text-faint">
                  <th className="pb-2 pr-3 font-medium">Variant</th>
                  <th className="pb-2 pr-3 font-medium">Market</th>
                  <th className="pb-2 pr-3 font-medium">Low</th>
                  <th className="pb-2 font-medium">High</th>
                </tr>
              </thead>
              <tbody>
                {referencePrices.tcgPlayerPrices.map((row) => (
                  <tr key={row.variant} className="border-b border-border-subtle/40 last:border-0">
                    <td className="py-2 pr-3 text-primary">{labelTcgVariant(row.variant)}</td>
                    <td className="py-2 pr-3 font-mono text-accent">{fmtUsd(row.market ?? row.mid)}</td>
                    <td className="py-2 pr-3 font-mono text-muted">{fmtUsd(row.low)}</td>
                    <td className="py-2 font-mono text-muted">{fmtUsd(row.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {comps.length > 0 ? (
        <Card className="desk-surface-raised p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-primary">Institutional comps</h2>
          <p className="mt-0.5 text-[10px] text-faint">
            Persisted sold, active, and reference rows from scans and nightly ingest.
          </p>
          <ul className="mt-3 divide-y divide-border-subtle/50">
            {comps.slice(0, 32).map((row) => (
              <li key={row.id} className="flex gap-3 py-2.5 first:pt-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase",
                        kindBadge(row.kind),
                      )}
                    >
                      {row.kind}
                    </span>
                    {row.gradeBucket ? (
                      <span className="text-[10px] text-faint">
                        {gradeBucketLabel(row.gradeBucket as GradeBucket)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-primary">{row.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {row.source ?? "source n/a"} · {formatObserved(row.observedAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-sm text-accent">{fmtUsd(row.priceUsd)}</p>
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-medium text-accent underline-offset-2 hover:underline"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {population.length > 0 ? (
        <Card className="desk-surface-raised p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-primary">Population</h2>
          <ul className="mt-3 space-y-2">
            {population.map((row, i) => (
              <li
                key={`${row.grader}-${row.grade}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border-subtle/60 bg-panel-raised/30 px-3 py-2 text-xs"
              >
                <span className="font-medium text-primary">
                  {row.grader}
                  {row.grade ? ` ${row.grade}` : ""}
                </span>
                <span className="font-mono text-accent">
                  {row.populationCount != null
                    ? row.populationCount.toLocaleString()
                    : row.populationNote ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {certifications.length > 0 ? (
        <Card className="desk-surface-raised p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-primary">Certifications</h2>
          <ul className="mt-3 space-y-2">
            {certifications.map((row) => (
              <li
                key={`${row.grader}-${row.certNumber}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle/60 bg-panel-raised/30 px-3 py-2 text-xs"
              >
                <span className="text-primary">
                  {row.grader} {row.grade ?? ""} · #{row.certNumber}
                </span>
                {row.registryUrl ? (
                  <a
                    href={row.registryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent underline-offset-2 hover:underline"
                  >
                    Registry
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <p className="text-center text-[10px] text-faint">
        Refreshed {formatObserved(knowledge.refreshedAt)} ·{" "}
        <Link href={marketPokemonHref(knowledge.catalogId)} className="underline-offset-2 hover:underline">
          Permalink
        </Link>
      </p>
    </div>
  );
}
