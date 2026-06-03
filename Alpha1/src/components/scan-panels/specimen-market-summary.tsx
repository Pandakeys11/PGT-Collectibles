"use client";

import { Loader2 } from "lucide-react";
import { FmvHeadlineBlock } from "@/components/market/fmv-headline-block";
import { MarketLaneCompGrid } from "@/components/market/market-lane-comp-grid";
import { SourceChips } from "@/components/scan-panels/source-chips";
import { useCatalogIntelLite } from "@/hooks/use-catalog-intel-lite";
import { catalogMarketEligible, useCatalogMarket } from "@/hooks/use-catalog-market";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { buildScanMarketPresentation } from "@/lib/scan/scan-market-present";
import { printIdentityMarketScopeLabel } from "@/lib/scan/print-identity-ui";
import { formatStickerPrice } from "@/lib/scan/sheet-present";
import { cn } from "@/lib/cn";

function catalogStatusLabel(status: ScanSpecimen["context"]["catalogIdentityStatus"]): string {
  if (status === "confirmed") return "Catalog confirmed";
  if (status === "likely") return "Catalog likely";
  if (status === "ambiguous") return "Catalog ambiguous";
  return "Catalog unmatched";
}

function CompTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[4.5rem] flex-1 rounded-lg bg-panel-raised/40 px-2 py-1.5">
      <p className="text-desk-label text-[0.6875rem]">{label}</p>
      <p className="mt-0.5 font-mono text-[12px] text-primary tabular-nums">{value}</p>
    </div>
  );
}

function PriceChartingTierRow({
  tiers,
}: {
  tiers: { label: string; usd: number | null }[];
}) {
  if (!tiers.length) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-200/85">
        PriceCharting graded (PSA 8–10)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tiers.map((tier) => (
          <div
            key={tier.label}
            className="min-w-[4rem] flex-1 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-2 py-1.5"
          >
            <p className="text-[7px] font-semibold uppercase tracking-wider text-muted">{tier.label}</p>
            <p className="font-mono text-[11px] font-medium tabular-nums text-violet-200/95">
              {tier.usd != null ? `$${Math.round(tier.usd).toLocaleString()}` : "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpecimenMarketSummary({
  specimen,
  enriching = false,
  variant = "default",
  className,
}: {
  specimen: ScanSpecimen;
  enriching?: boolean;
  variant?: "default" | "compact" | "hero" | "desk";
  className?: string;
}) {
  const catalogId = specimen.context.catalogId?.trim() ?? "";
  const useCatalog = catalogMarketEligible(catalogId, specimen.context.catalogIdentityStatus);
  const printingHint = specimen.card.printStamps?.trim() || null;
  const compScope = printIdentityMarketScopeLabel(specimen);

  const { payload: catalogPayload, loading: catalogLoading } = useCatalogMarket(catalogId, {
    enabled: useCatalog,
    printingHint,
  });
  const { referencePrices: catalogReferencePrices } = useCatalogIntelLite(catalogId, {
    enabled: useCatalog && variant !== "compact",
  });

  const snapshot = catalogPayload?.snapshot;
  const market = buildScanMarketPresentation(specimen, {
    snapshot,
    marketSourceLinks: catalogPayload?.marketSourceLinks,
    pricesInput: catalogReferencePrices,
  });

  const { headline, lanes, compChips, sources, dataSource, ready, scanReady, indexReady, priceChartingTiers } =
    market;

  const showCatalogId =
    catalogId &&
    (specimen.context.catalogIdentityStatus === "confirmed" ||
      specimen.context.catalogIdentityStatus === "likely");

  const showCatalogSpinner = useCatalog && catalogLoading && !scanReady && !indexReady;
  const headlineSize = variant === "hero" ? "hero" : variant === "compact" ? "compact" : "default";

  if (variant === "desk") {
    return (
      <div className={cn("relative min-w-0 text-right", className)}>
        {enriching || showCatalogSpinner ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-end" aria-hidden>
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          </div>
        ) : null}
        <p className="text-desk-label">Verified value</p>
        <p className="text-desk-value mt-0.5 text-accent tabular-nums">{headline.amount}</p>
        {(headline.basisLabel || headline.holdMessage) && !headline.held ? (
          <p className="mt-0.5 text-[0.6875rem] text-muted">
            Basis · {headline.basisLabel ?? headline.holdMessage}
          </p>
        ) : headline.held && headline.holdMessage ? (
          <p className="mt-0.5 text-[0.6875rem] text-amber-300/85">{headline.holdMessage}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("relative min-w-0", className)}>
      {enriching || showCatalogSpinner ? (
        <div
          className="absolute inset-0 z-[1] flex items-center justify-center rounded-xl bg-canvas/60 backdrop-blur-[1px]"
          aria-hidden
        >
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-xl bg-panel-raised/40 p-2.5",
          variant === "compact" && "p-2",
          variant === "hero" && "bg-panel-raised/55 p-4",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <FmvHeadlineBlock headline={headline} size={headlineSize} className="border-0 bg-transparent p-0" />
            {compScope ? (
              <p className="mt-1 text-[0.6875rem] text-violet-300/85" title="Market comps filtered to this print run">
                Comps scoped to · {compScope}
              </p>
            ) : null}
            {dataSource && variant !== "compact" ? (
              <p className="mt-0.5 text-[0.6875rem] text-faint">{dataSource}</p>
            ) : null}
          </div>
          <div className="text-right text-[10px] leading-snug">
            <p className="font-medium text-muted">{catalogStatusLabel(specimen.context.catalogIdentityStatus)}</p>
            {showCatalogId ? (
              <p className="mt-0.5 font-mono text-faint" title="Pokémon TCG API catalog id">
                {catalogId}
              </p>
            ) : null}
          </div>
        </div>

        {variant !== "compact" ? (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <CompTile label="Raw sold" value={ready ? compChips.rawSold : "—"} />
              <CompTile label="PSA 10" value={ready ? compChips.psa10Sold : "—"} />
              <CompTile label="Listed" value={ready ? compChips.listed : "—"} />
              <div className="min-w-[4.5rem] flex-1 rounded-lg bg-panel-raised/40 px-2 py-1.5">
                <p className="text-desk-label text-[0.6875rem]">Sticker / ask</p>
                <p
                  className={cn(
                    "mt-0.5 font-mono text-[12px] tabular-nums",
                    specimen.context.askingUsd != null || specimen.card.extractedPrice != null
                      ? "text-amber-400/95"
                      : "text-faint",
                  )}
                >
                  {formatStickerPrice(specimen)}
                </p>
              </div>
            </div>

            {lanes.length > 0 ? (
              <div className="mt-2">
                <MarketLaneCompGrid lanes={lanes} />
              </div>
            ) : null}

            <PriceChartingTierRow tiers={priceChartingTiers} />

            <div className="desk-divider mt-2 border-t pt-2">
              <p className="text-desk-label text-[0.6875rem]">Sources</p>
              <SourceChips sources={sources} maxVisible={4} className="mt-1" />
              {!ready && !enriching && !showCatalogSpinner ? (
                <p className="mt-1.5 text-[10px] text-muted">
                  Market research pending — comps appear after enrich or catalog index load.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
