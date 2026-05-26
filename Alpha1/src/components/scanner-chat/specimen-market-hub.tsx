"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, Layers } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  computeFilteredFmv,
  evidenceRowKey,
  outlierEvidenceKeys,
} from "@/lib/scan/comps-analytics";
import {
  filterMarketEvidence,
  marketDecision,
  marketStats,
  type GradedGradeFilter,
  type MarketLaneFilter,
  type RawConditionFilter,
} from "@/lib/scan/market-intelligence";
import { buildSpecimenMarketView } from "@/lib/scan/specimen-market-view";
import { SpecimenMarketSummary } from "@/components/scan-panels/specimen-market-summary";
import { GradedRegistryPanel } from "@/components/scan-panels/graded-registry-panel";
import { MarketPriceHeatmap } from "@/components/scanner-chat/market-price-heatmap";
import { MarketPremiumGrades } from "@/components/scanner-chat/market-premium-grades";
import { MarketListingCard } from "@/components/scanner-chat/market-listing-card";
import { MarketEvidenceFeed } from "@/components/scanner-chat/market-evidence-row";
import { MarketSoldsList } from "@/components/scanner-chat/market-solds-list";
import { MarketSourceAds } from "@/components/scanner-chat/market-source-ads";
import { cn } from "@/lib/cn";

type MarketTab = "overview" | "listed" | "sold" | "auctions";

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-0 truncate rounded-md px-1 py-1.5 text-center text-[9px] font-medium transition",
        active
          ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30"
          : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
      )}
    >
      {label}
    </button>
  );
}

function CompsSectionHeader({
  title,
  count,
  hint,
}: {
  title: string;
  count?: number;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <div className="flex items-center gap-2 text-[9px] text-slate-600">
        {hint ? <span className="max-w-[10rem] truncate">{hint}</span> : null}
        {count != null ? (
          <span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-slate-400">
            {count}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5">
      <p className="truncate text-[9px] uppercase tracking-wider text-slate-600">{label}</p>
      <p className="mt-0.5 truncate font-mono text-sm font-semibold text-slate-100 tabular-nums">
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 truncate text-[9px] text-slate-500" title={detail}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export function SpecimenMarketHub({
  specimen,
  enriching,
  excludedKeys,
  onToggleExclude,
  compsSectionRef,
  className,
}: {
  specimen: ScanSpecimen;
  enriching?: boolean;
  excludedKeys: Set<string>;
  onToggleExclude: (key: string) => void;
  compsSectionRef?: React.RefObject<HTMLDivElement>;
  /** @deprecated No longer used — kept for call-site compatibility */
  historyRefreshKey?: number;
  className?: string;
}) {
  const [tab, setTab] = useState<MarketTab>("overview");
  const [lane, setLane] = useState<MarketLaneFilter>("all");
  const [rawCondition, setRawCondition] = useState<RawConditionFilter>("all");
  const [gradedGrade, setGradedGrade] = useState<GradedGradeFilter>("all");

  const view = useMemo(() => buildSpecimenMarketView(specimen), [specimen]);
  const stats = useMemo(() => marketStats(specimen), [specimen]);
  const decision = useMemo(() => marketDecision(specimen, stats), [specimen, stats]);

  const filteredEvidence = useMemo(() => {
    if (!view) return [];
    const kind =
      tab === "sold" ? "sold" : tab === "listed" ? "active" : ("all" as const);
    return filterMarketEvidence(stats.evidence, {
      lane,
      rawCondition,
      gradedGrade,
      kind: tab === "auctions" ? "all" : kind,
    });
  }, [stats.evidence, lane, rawCondition, gradedGrade, tab, view]);

  const auctionEvidence = useMemo(() => {
    if (!view) return [];
    return filterMarketEvidence(view.auctions, {
      lane,
      rawCondition,
      gradedGrade,
      kind: "all",
    });
  }, [view, lane, rawCondition, gradedGrade]);

  const listedForFeed = useMemo(() => {
    if (!view) return [];
    return filterMarketEvidence(view.active, {
      lane,
      rawCondition,
      gradedGrade,
      kind: "active",
    });
  }, [view, lane, rawCondition, gradedGrade]);

  const soldForFeed = useMemo(() => {
    if (!view) return [];
    return filterMarketEvidence(view.sold, {
      lane,
      rawCondition,
      gradedGrade,
      kind: "sold",
    });
  }, [view, lane, rawCondition, gradedGrade]);

  const outlierKeys = useMemo(
    () => outlierEvidenceKeys(filteredEvidence),
    [filteredEvidence],
  );

  const adjustedFmv = useMemo(
    () => computeFilteredFmv(filteredEvidence, excludedKeys),
    [filteredEvidence, excludedKeys],
  );

  const applyPreset = (preset: "raw_nm" | "psa10" | "psa9" | "bgs_bl" | "cgc_pristine") => {
    if (preset === "raw_nm") {
      setLane("raw");
      setRawCondition("nm");
      setGradedGrade("all");
      setTab("sold");
      return;
    }
    setLane("graded");
    setRawCondition("all");
    setTab("sold");
    if (preset === "psa10") setGradedGrade("psa10");
    else if (preset === "psa9") setGradedGrade("psa9");
    else if (preset === "bgs_bl") setGradedGrade("bgsBlackLabel");
    else setGradedGrade("cgcPristine10");
  };

  if (!view) return null;

  const toneClass = {
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100",
    rose: "border-rose-500/25 bg-rose-500/10 text-rose-100",
    cyan: "border-sky-500/25 bg-sky-500/10 text-sky-100",
    slate: "border-white/10 bg-white/[0.04] text-slate-200",
  }[decision.tone];

  const chartEvidence = filteredEvidence.filter(
    (item) => !excludedKeys.has(evidenceRowKey(item)),
  );

  return (
    <div className={cn("min-w-0 w-full space-y-3", className)} ref={compsSectionRef}>
      <div className={cn("rounded-xl border p-2.5", toneClass)}>
        <div className="flex gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{decision.label}</p>
            <p className="mt-0.5 text-xs opacity-85">{decision.detail}</p>
          </div>
        </div>
      </div>

      <SpecimenMarketSummary
        specimen={specimen}
        enriching={enriching}
        variant="hero"
        className="min-w-0 rounded-xl border border-white/8 sc-glass-raised p-3"
      />

      <MarketPremiumGrades
        rows={view.premiumGrades}
        hubMap={view.hubMap}
        card={specimen.card}
        specimenId={specimen.id}
        enriching={enriching}
        sessionCompCount={specimen.context.marketEvidence?.length ?? 0}
        marketAsOf={specimen.context.marketAsOf}
      />

      <div className="grid min-w-0 grid-cols-3 gap-1.5">
        <StatTile label="Sold" value={String(stats.sold.length)} detail="Session comps" />
        <StatTile label="Listed" value={String(stats.active.length)} detail="Live asks" />
        <StatTile
          label="Adj. FMV"
          value={
            adjustedFmv.fmv != null
              ? `$${Math.round(adjustedFmv.fmv).toLocaleString()}`
              : "—"
          }
          detail={
            excludedKeys.size > 0
              ? `${adjustedFmv.soldCount} comps · ${excludedKeys.size} out`
              : view.targetLabel
          }
        />
      </div>

      <GradedRegistryPanel
        specimen={specimen}
        enriching={enriching}
        variant="compact"
        className="min-w-0"
      />

      <div className="grid min-w-0 grid-cols-4 gap-0.5 rounded-xl border border-white/8 bg-black/25 p-0.5">
        {(
          [
            ["overview", "Overview"],
            ["listed", `Listed (${listedForFeed.length})`],
            ["sold", `Solds (${soldForFeed.length})`],
            ["auctions", `Auc (${auctionEvidence.length})`],
          ] as const
        ).map(([id, label]) => (
          <FilterChip
            key={id}
            active={tab === id}
            label={label}
            onClick={() => setTab(id)}
          />
        ))}
      </div>

      {tab === "overview" ? (
        <div className="min-w-0 space-y-3">
          <MarketPriceHeatmap
            specimen={specimen}
            evidence={chartEvidence}
            fmvOverride={adjustedFmv.fmv}
            className="min-w-0"
          />

          <section className="min-w-0 space-y-2 rounded-xl border border-white/8 bg-black/15 p-2.5">
            <CompsSectionHeader
              title="Recent sales"
              count={soldForFeed.length}
              hint="Session sold comps"
            />
            <MarketEvidenceFeed
              items={soldForFeed}
              hubMap={view.hubMap}
              ebayGradeHubs={view.ebayGradeHubs}
              card={specimen.card}
              excludedKeys={excludedKeys}
              outlierKeys={outlierKeys}
              onToggleExclude={onToggleExclude}
              maxRows={5}
              emptyMessage="No sold comps yet — run enrich or open eBay sold via Search links."
            />
          </section>

          <section className="min-w-0 space-y-2 rounded-xl border border-white/8 bg-black/15 p-2.5">
            <CompsSectionHeader
              title="Live listings"
              count={listedForFeed.length}
              hint="Active asks & BIN"
            />
            <MarketEvidenceFeed
              items={listedForFeed}
              hubMap={view.hubMap}
              ebayGradeHubs={view.ebayGradeHubs}
              card={specimen.card}
              maxRows={5}
              emptyMessage="No live listings in session — check Listed tab or run enrich."
            />
          </section>

          <MarketSourceAds sources={view.sourceAds} />
        </div>
      ) : null}

      {tab === "listed" ? (
        <section className="min-w-0 space-y-2 rounded-xl border border-white/8 bg-black/15 p-2.5">
          <CompsSectionHeader
            title="Live listings"
            count={listedForFeed.length}
            hint="Active asks from enrich"
          />
          <MarketEvidenceFeed
            items={listedForFeed}
            hubMap={view.hubMap}
            ebayGradeHubs={view.ebayGradeHubs}
            card={specimen.card}
            maxRows={20}
            emptyMessage="No active listings in session. Use Shop & research below or re-run enrich."
          />
          <MarketSourceAds sources={view.sourceAds} />
        </section>
      ) : null}

      {tab === "sold" ? (
        <section className="min-w-0 space-y-2">
          <p className="text-[10px] text-slate-500">
            Newest sold comps first. Uncheck rows to tune adjusted FMV.
          </p>
          <MarketSoldsList
            items={soldForFeed}
            hubMap={view.hubMap}
            ebayGradeHubs={view.ebayGradeHubs}
            card={specimen.card}
            excludedKeys={excludedKeys}
            outlierKeys={outlierKeys}
            onToggleExclude={onToggleExclude}
            maxRows={14}
          />
        </section>
      ) : null}

      {tab === "auctions" ? (
        <section className="min-w-0 space-y-2">
          <p className="text-[10px] text-slate-500">
            PWCC, Goldin, Heritage, and auction-style listings when present in enrich.
          </p>
          {auctionEvidence.length > 0 ? (
            <div className="grid min-w-0 grid-cols-1 gap-2">
              {auctionEvidence.map((item) => (
                <MarketListingCard
                  key={evidenceRowKey(item)}
                  item={item}
                  hubMap={view.hubMap}
                  ebayGradeHubs={view.ebayGradeHubs}
                  card={specimen.card}
                  variant="auction"
                  layout="fill"
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-8 text-center text-xs text-slate-500">
              No auction comps in this session. Open Goldin / PWCC via source links.
            </p>
          )}
        </section>
      ) : null}

      <details className="group min-w-0 rounded-xl border border-white/8 bg-white/[0.02]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Layers className="h-3.5 w-3.5" />
            Advanced filters
          </span>
          <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-white/8 px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "All"],
                ["raw", "Raw"],
                ["graded", "Graded"],
              ] as const
            ).map(([id, label]) => (
              <FilterChip key={id} active={lane === id} label={label} onClick={() => setLane(id)} />
            ))}
          </div>
          {lane !== "graded" ? (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "Any"],
                  ["nm", "NM"],
                  ["lp", "LP"],
                  ["mp", "MP"],
                ] as const
              ).map(([id, label]) => (
                <FilterChip
                  key={id}
                  active={rawCondition === id}
                  label={label}
                  onClick={() => setRawCondition(id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["all", "All grades"],
                  ["psa10", "PSA 10"],
                  ["bgsBlackLabel", "BGS BL"],
                  ["cgcPristine10", "CGC P10"],
                  ["psa9", "PSA 9"],
                  ["bgs10", "BGS 10"],
                  ["cgc10", "CGC 10"],
                ] as const
              ).map(([id, label]) => (
                <FilterChip
                  key={id}
                  active={gradedGrade === id}
                  label={label}
                  onClick={() => setGradedGrade(id)}
                />
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            <FilterChip active={false} label="Raw NM" onClick={() => applyPreset("raw_nm")} />
            <FilterChip active={false} label="PSA 10" onClick={() => applyPreset("psa10")} />
            <FilterChip active={false} label="BGS BL" onClick={() => applyPreset("bgs_bl")} />
            <FilterChip
              active={false}
              label="CGC P10"
              onClick={() => applyPreset("cgc_pristine")}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
