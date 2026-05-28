"use client";

import { Loader2 } from "lucide-react";
import { SourceChips } from "@/components/scan-panels/source-chips";
import { catalogMarketEligible, useCatalogMarket } from "@/hooks/use-catalog-market";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  catalogMarketReady,
  formatCatalogCompListed,
  formatCatalogCompPsa10Sold,
  formatCatalogCompRawSold,
  formatCatalogFmvHero,
  summarizeCatalogSources,
} from "@/lib/scan/catalog-market-present";
import {
  formatCompChipListed,
  formatCompChipPsa10Sold,
  formatCompChipRawSold,
  formatFairMarketValueHero,
  formatStickerPrice,
  marketDataReady,
  summarizeSources,
} from "@/lib/scan/sheet-present";
import { printIdentityMarketScopeLabel } from "@/lib/scan/print-identity-ui";
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

  const snapshot = catalogPayload?.snapshot;
  const scanReady = marketDataReady(specimen);
  const indexReady = catalogMarketReady(snapshot);
  const ready = scanReady || indexReady;

  const scanHero = formatFairMarketValueHero(specimen);
  const indexHero = snapshot ? formatCatalogFmvHero(snapshot) : { amount: "—", basis: null };
  const hero = scanReady ? scanHero : indexReady ? indexHero : scanHero;

  const rawComp = scanReady
    ? formatCompChipRawSold(specimen)
    : indexReady && snapshot
      ? formatCatalogCompRawSold(snapshot)
      : "—";
  const psa10Comp = scanReady
    ? formatCompChipPsa10Sold(specimen)
    : indexReady && snapshot
      ? formatCatalogCompPsa10Sold(snapshot)
      : "—";
  const listedComp = scanReady
    ? formatCompChipListed(specimen)
    : indexReady && snapshot
      ? formatCatalogCompListed(snapshot)
      : "—";

  const sources = scanReady
    ? summarizeSources(specimen)
    : indexReady && snapshot
      ? summarizeCatalogSources(snapshot, catalogPayload?.marketSourceLinks ?? [])
      : [];

  const showCatalogId =
    catalogId &&
    (specimen.context.catalogIdentityStatus === "confirmed" ||
      specimen.context.catalogIdentityStatus === "likely");

  const dataSource =
    scanReady && indexReady
      ? "Session + index"
      : scanReady
        ? "Scan session"
        : indexReady
          ? "Catalog index"
          : null;

  const showCatalogSpinner = useCatalog && catalogLoading && !scanReady && !indexReady;

  if (variant === "desk") {
    return (
      <div className={cn("relative min-w-0 text-right", className)}>
        {enriching || showCatalogSpinner ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-end" aria-hidden>
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          </div>
        ) : null}
        <p className="text-desk-label">Verified value</p>
        <p className="text-desk-value mt-0.5 text-accent tabular-nums">{hero.amount}</p>
        {hero.basis ? <p className="mt-0.5 text-[0.6875rem] text-muted">Basis · {hero.basis}</p> : null}
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
          <div className="min-w-0">
            <p className="text-desk-label">Fair market value</p>
            <p
              className={cn(
                "mt-0.5 font-semibold tabular-nums text-accent",
                variant === "hero" ? "text-2xl" : variant === "compact" ? "text-sm" : "text-lg",
              )}
            >
              {hero.amount}
            </p>
            {hero.basis ? <p className="mt-0.5 text-[0.6875rem] text-muted">Basis · {hero.basis}</p> : null}
            {compScope ? (
              <p className="mt-0.5 text-[0.6875rem] text-violet-300/85" title="Market comps filtered to this print run">
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
              <CompTile label="Raw sold" value={ready ? rawComp : "—"} />
              <CompTile label="PSA 10" value={ready ? psa10Comp : "—"} />
              <CompTile label="Listed" value={ready ? listedComp : "—"} />
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
