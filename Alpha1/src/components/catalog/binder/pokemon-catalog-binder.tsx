"use client";

import type { ReactNode } from "react";
import { CatalogBinderTrackerBar } from "@/components/catalog/binder/catalog-binder-tracker-bar";
import { CatalogBinderViewer } from "@/components/catalog/binder/catalog-binder-viewer";
import { CatalogCardFmvRibbon } from "@/components/catalog/catalog-card-fmv-badge";
import { CatalogCardGradedRibbon } from "@/components/catalog/catalog-card-graded-ribbon";
import { CatalogVariantImage } from "@/components/pokedex/catalog-variant-image";
import { useCatalogBinderTracker } from "@/hooks/use-catalog-binder-tracker";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import type { CatalogVariantOverlayByCardId } from "@/lib/pokedex/catalog-variant-artwork";
import { resolveCatalogCardImages } from "@/lib/pokedex/catalog-variant-artwork";
import type { PrintingPresetId } from "@/lib/pokedex/set-catalog-config";
import { printingPresetMarketSuffix } from "@/lib/pokedex/set-catalog-config";
import { cn } from "@/lib/cn";

function preferDistinctCurated(api: string | undefined, resolved: string | undefined): string | undefined {
  if (!resolved?.trim()) return undefined;
  if (!api?.trim()) return resolved;
  return resolved.trim() !== api.trim() ? resolved : undefined;
}

function binderNumberLabel(number: string | undefined): string {
  const n = (number ?? "").replace(/^#/, "").trim();
  return n ? `#${n.split("/")[0]}` : "—";
}

export function PokemonCatalogBinder({
  cards,
  loading,
  error,
  setId,
  setName,
  printingPreset,
  variantArtworkOverlay,
  onSelectCard,
  embedded = false,
  filterChrome,
  className,
}: {
  cards: TcgCardSummary[];
  loading?: boolean;
  error?: string | null;
  setId: string;
  setName: string;
  printingPreset: PrintingPresetId;
  variantArtworkOverlay: CatalogVariantOverlayByCardId | null;
  onSelectCard: (card: TcgCardSummary) => void;
  embedded?: boolean;
  filterChrome?: ReactNode;
  className?: string;
}) {
  const printingMarketSuffix = printingPresetMarketSuffix(setId, printingPreset);
  const tracker = useCatalogBinderTracker(setId, cards.length);

  return (
    <CatalogBinderViewer
      cards={cards}
      loading={loading}
      error={error}
      setName={setName}
      embedded={embedded}
      filterChrome={filterChrome}
      className={className}
      trackerBar={
        <CatalogBinderTrackerBar
          progressLabel={tracker.progressLabel}
          trackerEnabled={tracker.trackerEnabled}
          loading={tracker.loading}
          saving={tracker.saving}
          error={tracker.error}
          isSignedIn={tracker.isSignedIn}
          isLoaded={tracker.isLoaded}
          email={tracker.email}
          onTrackerEnabledChange={(enabled) => {
            tracker.setTrackerEnabled(enabled);
          }}
        />
      }
      getKey={(c) => `${c.id}-${c.catalogFinish ?? "std"}`}
      renderSlot={(c, { priority }) => {
        const apiSmall = c.images?.small;
        const resolved = resolveCatalogCardImages({
          setId,
          card: c,
          printingPreset,
          overlay: variantArtworkOverlay,
        });
        const preferred = preferDistinctCurated(apiSmall, resolved.small);
        const hasArt = Boolean(apiSmall || preferred);
        const owned = tracker.isOwned(c.id);
        const showUnownedTone = tracker.trackerEnabled && !owned;

        return (
          <div
            className={cn(
              "sc-binder-card-wrap",
              tracker.trackerEnabled && owned && "sc-binder-card-wrap--owned",
              showUnownedTone && "sc-binder-card-wrap--unowned",
            )}
          >
            {tracker.trackerEnabled && tracker.isSignedIn ? (
              <label
                className="sc-binder-owned-check"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={owned}
                  disabled={tracker.saving}
                  onChange={() => tracker.toggleOwned(c.id)}
                  aria-label={owned ? `Mark ${c.name} as not owned` : `Mark ${c.name} as owned`}
                />
              </label>
            ) : null}
            <button
              type="button"
              className="sc-binder-card-btn"
              onClick={() => onSelectCard(c)}
              aria-label={`${c.name} ${binderNumberLabel(c.number)}${owned ? ", owned" : ""}`}
            >
              <div className="sc-binder-card-art">
                {hasArt ? (
                  <>
                    <CatalogVariantImage
                      apiSrc={apiSmall}
                      preferredSrc={preferred}
                      alt=""
                      priority={priority}
                      className="h-full w-full object-contain object-[center_top]"
                    />
                    <div className="sc-binder-card-art__holo" aria-hidden />
                  </>
                ) : (
                  <div className="sc-binder-placeholder">
                    <div className="sc-binder-placeholder__sprite">
                      <span className="text-lg opacity-30" aria-hidden>
                        ◇
                      </span>
                    </div>
                    <p className="sc-binder-placeholder__title">
                      {c.name}
                      <br />
                      {binderNumberLabel(c.number)}
                    </p>
                    {c.set?.series ? (
                      <p className="sc-binder-placeholder__gen">{c.set.series}</p>
                    ) : null}
                  </div>
                )}
                <div className="sc-binder-card-labels pointer-events-none absolute inset-x-0.5 top-0.5 z-[5] flex justify-between gap-0.5">
                  {c.catalogFinish === "reverse_holo" ? (
                    <span className="rounded bg-violet-950/85 px-0.5 py-px text-[6px] font-bold uppercase text-white">
                      Rev
                    </span>
                  ) : null}
                  {printingMarketSuffix ? (
                    <span
                      className={cn(
                        "ml-auto rounded bg-black/60 px-0.5 py-px text-[6px] font-bold uppercase text-white",
                      )}
                    >
                      {printingMarketSuffix}
                    </span>
                  ) : null}
                </div>
                <CatalogCardGradedRibbon
                  catalogPrices={c.catalogPrices}
                  tcgplayer={c.tcgplayer}
                  cardmarket={c.cardmarket}
                />
                <CatalogCardFmvRibbon
                  size="binder"
                  catalogPrices={c.catalogPrices}
                  tcgplayer={c.tcgplayer}
                  cardmarket={c.cardmarket}
                  catalogFinish={c.catalogFinish}
                  rarity={c.rarity}
                  name={c.name}
                  number={c.number}
                  setName={c.set?.name}
                  rawFmvUsd={c.rawFmvUsd}
                  rawFmvSourceLabel={c.rawFmvSourceLabel}
                />
              </div>
            </button>
          </div>
        );
      }}
    />
  );
}
