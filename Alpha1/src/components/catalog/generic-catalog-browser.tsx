"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LineChart, Loader2, Search } from "lucide-react";
import { marketPokemonHref } from "@/lib/app-routes";
import { catalogVariantLabelFromCatalogId } from "@/lib/scan/print-identity-ui";
import { CatalogCardDetailSheet } from "@/components/catalog/catalog-card-detail-sheet";
import {
  CatalogCardDetailActions,
  CatalogCardDetailBody,
} from "@/components/catalog/catalog-card-detail-body";
import {
  CATALOG_CARD_ART_FRAME,
  CATALOG_CARD_FOOTER,
  CATALOG_CARD_GRID_4X4,
  CATALOG_CARD_GRID_MOBILE_STEP,
  CATALOG_CARD_IMAGE_PAD,
  CATALOG_CARD_META_CLASS,
  CATALOG_CARD_NAME_CLASS,
  CATALOG_CARD_SHELL,
} from "@/lib/catalog/catalog-grid-layout";
import { useCatalogAmbientOptional } from "@/components/effects/catalog-ambient-provider";
import { CatalogSetTileGrid } from "@/components/catalog/catalog-set-tile-grid";
import type { CatalogSetTileModel } from "@/components/catalog/catalog-set-tile";
import { CatalogCardFmvRibbon } from "@/components/catalog/catalog-card-fmv-badge";
import { tcgPlayerEmbedFromSnapshot } from "@/lib/market/catalog-raw-fmv";
import { CatalogFocusGrid } from "@/components/pokedex/catalog-focus-grid";
import { useCatalogMobileLayout } from "@/hooks/use-catalog-mobile-layout";
import { ScanThisCardButton } from "@/components/pokedex/scan-this-card-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CatalogCardSummary,
  CatalogFranchiseId,
  CatalogFranchiseMeta,
  CatalogPaginated,
  CatalogSetSummary,
} from "@/lib/catalog/catalog-types";
import { releaseYearFromDate } from "@/lib/catalog/catalog-types";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 48;

function cardToPrefill(card: CatalogCardSummary, franchise: CatalogFranchiseId): CatalogScanPrefill {
  return {
    franchise,
    catalogId: card.id,
    name: card.name,
    set: card.set?.name,
    number: card.number ?? undefined,
    year: releaseYearFromDate(card.set?.releaseDate) ?? undefined,
    rarity: card.rarity ?? undefined,
    catalogImageUrl: card.images?.small ?? card.images?.large,
  };
}

export function GenericCatalogBrowser({
  franchise,
  meta,
  embedded = false,
  scanTargetPath,
  onScanPrefill,
}: {
  franchise: CatalogFranchiseId;
  meta: CatalogFranchiseMeta;
  embedded?: boolean;
  scanTargetPath?: string;
  onScanPrefill?: (prefill: CatalogScanPrefill) => void;
}) {
  const catalogAmbient = useCatalogAmbientOptional();
  const [setQuery, setSetQuery] = useState("");
  const [debouncedSetQ, setDebouncedSetQ] = useState("");
  const [setsPage, setSetsPage] = useState(1);
  const [sets, setSets] = useState<CatalogSetSummary[]>([]);
  const [setsMeta, setSetsMeta] = useState({ totalCount: 0, pageSize: 40 });
  const [setsLoading, setSetsLoading] = useState(true);
  const [setsError, setSetsError] = useState<string | null>(null);

  const [selectedSet, setSelectedSet] = useState<CatalogSetSummary | null>(null);
  const [cardQuery, setCardQuery] = useState("");
  const [debouncedCardQ, setDebouncedCardQ] = useState("");
  const [cardsPage, setCardsPage] = useState(1);
  const [cards, setCards] = useState<CatalogCardSummary[]>([]);
  const [cardsMeta, setCardsMeta] = useState({ totalCount: 0, pageSize: PAGE_SIZE });
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);
  const [detail, setDetail] = useState<CatalogCardSummary | null>(null);
  const mobileStepped = useCatalogMobileLayout(embedded);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSetQ(setQuery.trim()), 280);
    return () => clearTimeout(t);
  }, [setQuery]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCardQ(cardQuery.trim()), 280);
    return () => clearTimeout(t);
  }, [cardQuery]);

  useEffect(() => {
    setSetsPage(1);
    setSelectedSet(null);
    setDetail(null);
  }, [franchise, debouncedSetQ]);

  useEffect(() => {
    let cancelled = false;
    setSetsLoading(true);
    setSetsError(null);
    const q = new URLSearchParams({
      franchise,
      page: String(setsPage),
      pageSize: "40",
    });
    if (debouncedSetQ) q.set("q", debouncedSetQ);

    void fetch(`/api/catalog/sets?${q}`)
      .then(async (r) => {
        const body = (await r.json()) as CatalogPaginated<CatalogSetSummary> & { error?: string };
        if (!r.ok) throw new Error(body.error ?? "Failed to load sets");
        return body;
      })
      .then((data) => {
        if (cancelled) return;
        setSets(data.data);
        setSetsMeta({ totalCount: data.totalCount, pageSize: data.pageSize });
      })
      .catch((e) => {
        if (!cancelled) setSetsError(e instanceof Error ? e.message : "Failed to load sets");
      })
      .finally(() => {
        if (!cancelled) setSetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [franchise, setsPage, debouncedSetQ]);

  useEffect(() => {
    if (!selectedSet) return;
    setCardsPage(1);
  }, [selectedSet, selectedSet?.id, debouncedCardQ]);

  useEffect(() => {
    if (!selectedSet) return;
    let cancelled = false;
    setCardsLoading(true);
    setCardsError(null);
    const q = new URLSearchParams({
      franchise,
      setId: selectedSet.id,
      page: String(cardsPage),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedCardQ) q.set("q", debouncedCardQ);

    void fetch(`/api/catalog/cards?${q}`)
      .then(async (r) => {
        const body = (await r.json()) as CatalogPaginated<CatalogCardSummary> & { error?: string };
        if (!r.ok) throw new Error(body.error ?? "Failed to load cards");
        return body;
      })
      .then((data) => {
        if (cancelled) return;
        setCards(data.data);
        setCardsMeta({ totalCount: data.totalCount, pageSize: data.pageSize });
      })
      .catch((e) => {
        if (!cancelled) setCardsError(e instanceof Error ? e.message : "Failed to load cards");
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [franchise, selectedSet, cardsPage, debouncedCardQ]);

  const syncHint = useMemo(() => {
    if (meta.cardCountEstimate && meta.cardCountEstimate > 0) {
      const synced = meta.lastSyncedAt
        ? ` · last sync ${new Date(meta.lastSyncedAt).toLocaleDateString()}`
        : "";
      return `${meta.cardCountEstimate.toLocaleString()} cards in master catalog${synced}`;
    }
    return `No cached data yet — run npm run catalog:sync:all for ${meta.label}`;
  }, [meta]);

  const selectSet = useCallback((set: CatalogSetSummary) => {
    setSelectedSet(set);
    setDetail(null);
    setCardQuery("");
  }, []);

  const inputClass = embedded
    ? "h-8 rounded-md border-white/10 bg-white/[0.04] pl-8 text-[11px] text-slate-100 placeholder:text-slate-600 sm:h-8 sm:text-[11px]"
    : "h-10 pl-9";

  useEffect(() => {
    if (!catalogAmbient) return;
    catalogAmbient.registerSets(
      sets.map((s) => ({
        id: s.id,
        name: s.name,
        imageUrl: s.images?.logo ?? s.images?.symbol ?? undefined,
      })),
    );
  }, [catalogAmbient, sets]);

  useEffect(() => {
    catalogAmbient?.setFocusSetId(selectedSet?.id ?? null);
  }, [catalogAmbient, selectedSet?.id]);

  const setTiles: CatalogSetTileModel[] = sets.map((set) => ({
    id: set.id,
    name: set.name,
    series: set.series ?? null,
    releaseDate: set.releaseDate ?? null,
    year: set.year ?? null,
    total: set.total ?? null,
    printedTotal: set.total ?? null,
    images: set.images,
  }));

  const setsTotalPages = Math.max(1, Math.ceil(setsMeta.totalCount / setsMeta.pageSize));

  return (
    <div
      className={cn(
        "flex min-h-0 w-full min-w-0 max-w-full flex-col",
        embedded ? "flex-1 gap-2.5" : "space-y-3",
        embedded && mobileStepped && selectedSet && "sc-catalog-set-view-open",
      )}
    >
      {!(embedded && mobileStepped && selectedSet) ? (
        <>
          <p className={cn(embedded ? "text-[10px] leading-snug text-slate-500" : "text-[11px] text-muted")}>
            {syncHint}
          </p>

          <div className="relative">
            <Search
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-500",
                embedded ? "left-2 h-3.5 w-3.5" : "left-3 h-4 w-4 text-faint",
              )}
            />
            <Input
              value={setQuery}
              onChange={(e) => setSetQuery(e.target.value)}
              placeholder={`Search ${meta.label} sets…`}
              className={inputClass}
            />
          </div>
        </>
      ) : null}

      {!selectedSet ? (
        <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden")}>
          <CatalogSetTileGrid
            className="h-full min-h-0"
            sets={setTiles}
            onSelect={(tile) => {
              const hit = sets.find((s) => s.id === tile.id);
              if (hit) selectSet(hit);
            }}
            loading={setsLoading}
            error={setsError}
            density={embedded ? "browse" : "full"}
            emptyMessage="No sets yet. Run catalog sync or wait for the nightly job."
            page={setsPage}
            totalPages={setsTotalPages}
            totalCount={setsMeta.totalCount}
            pagingDisabled={setsLoading}
            onPrevPage={() => setSetsPage((p) => Math.max(1, p - 1))}
            onNextPage={() => setSetsPage((p) => p + 1)}
          />
        </div>
      ) : (
        <div className={cn("space-y-3", embedded && mobileStepped && "min-h-0 flex-1")}>
          <button
            type="button"
            onClick={() => {
              setSelectedSet(null);
              setDetail(null);
            }}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-amber-300/95 touch-manipulation hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
            All sets
          </button>
          <p
            className={cn(
              "font-semibold text-slate-100",
              embedded ? "text-[12px] leading-snug" : "font-display text-base text-primary",
            )}
          >
            {selectedSet.name}
          </p>

          <div className="relative">
            <Search
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-500",
                embedded ? "left-2 h-3.5 w-3.5" : "left-3 h-4 w-4 text-faint",
              )}
            />
            <Input
              value={cardQuery}
              onChange={(e) => setCardQuery(e.target.value)}
              placeholder="Filter cards in this set…"
              className={inputClass}
            />
          </div>

          {cardsLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading cards…
            </p>
          ) : cardsError ? (
            <p className="text-xs text-danger">{cardsError}</p>
          ) : cards.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted">
              No cards loaded for this set yet.
              {selectedSet.total != null && selectedSet.total > 0
                ? " The nightly catalog sync may still be catching up — try again soon or run npm run catalog:sync:all."
                : " This set may be unreleased or empty in the catalog source."}
            </p>
          ) : (
            <>
              <CatalogFocusGrid
                items={cards}
                gridClassName={
                  mobileStepped ? CATALOG_CARD_GRID_MOBILE_STEP : CATALOG_CARD_GRID_4X4
                }
                getKey={(c) => c.id}
                renderItem={(card, { focused }) => (
                  <button
                    type="button"
                    onClick={() => setDetail(card)}
                    className={cn(
                      "w-full",
                      CATALOG_CARD_SHELL,
                      "bg-[#070b10]",
                      detail?.id === card.id
                        ? "border-emerald-300/35 ring-1 ring-emerald-300/20"
                        : "border-white/10 hover:border-amber-200/25",
                      focused && "shadow-md shadow-black/40",
                    )}
                  >
                    <div className={cn(CATALOG_CARD_ART_FRAME, "bg-black/40")}>
                      {card.images?.small ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.images.small}
                          alt=""
                          className={cn(
                            "h-full w-full object-contain",
                            CATALOG_CARD_IMAGE_PAD,
                          )}
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[9px] text-faint">
                          No image
                        </div>
                      )}
                      {franchise === "pokemon" ? (
                        <CatalogCardFmvRibbon
                          catalogPrices={card.prices}
                          tcgplayer={tcgPlayerEmbedFromSnapshot(card.prices)}
                          catalogFinish={card.catalogFinish}
                          rarity={card.rarity}
                          name={card.name}
                          number={card.number}
                          setName={card.set?.name}
                        />
                      ) : null}
                    </div>
                    <div className={CATALOG_CARD_FOOTER}>
                      <p className={cn(CATALOG_CARD_NAME_CLASS, "line-clamp-2")}>{card.name}</p>
                      <p className={cn(CATALOG_CARD_META_CLASS, "truncate")}>
                        {[card.number, card.rarity].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                )}
              />
              {cardsMeta.totalCount > cardsPage * cardsMeta.pageSize ? (
                <div className="flex justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={cardsPage <= 1}
                    onClick={() => setCardsPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </Button>
                  <span className="self-center text-[10px] text-muted">
                    Page {cardsPage} · {cardsMeta.totalCount} cards
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={cardsPage * cardsMeta.pageSize >= cardsMeta.totalCount}
                    onClick={() => setCardsPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      <CatalogCardDetailSheet
        open={detail != null}
        onClose={() => setDetail(null)}
        onBack={() => setDetail(null)}
        title={detail?.name ?? "Card"}
        subtitle={
          detail
            ? [detail.set?.name ?? selectedSet?.name, detail.number, detail.rarity]
                .filter(Boolean)
                .join(" · ")
            : null
        }
        footer={
          detail ? (
            <CatalogCardDetailActions>
              <ScanThisCardButton
                prefill={cardToPrefill(detail, franchise)}
                targetPath={scanTargetPath}
                onScan={onScanPrefill}
                compact={false}
                className="w-full sm:flex-1"
              />
              {franchise === "pokemon" ? (
                <Button size="sm" variant="secondary" className="w-full sm:flex-1" asChild>
                  <Link href={marketPokemonHref(detail.id)}>
                    <LineChart className="mr-1.5 h-4 w-4" aria-hidden />
                    Market intel
                  </Link>
                </Button>
              ) : null}
            </CatalogCardDetailActions>
          ) : undefined
        }
      >
        {detail ? (
          <CatalogCardDetailBody
            identity={{
              catalogId: detail.id,
              name: detail.name,
              subtitle: [
                detail.set?.name ?? selectedSet?.name,
                detail.number ? `#${detail.number}` : null,
                detail.rarity,
                releaseYearFromDate(detail.set?.releaseDate) ?? undefined,
              ]
                .filter(Boolean)
                .join(" · "),
              image:
                detail.images?.large || detail.images?.small ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detail.images.large ?? detail.images.small}
                    alt={detail.name}
                    className="h-full w-full object-contain p-0.5"
                  />
                ) : undefined,
              extraRows: [
                {
                  label: "Print run",
                  value: catalogVariantLabelFromCatalogId(detail.id),
                },
                { label: "Set", value: detail.set?.name ?? selectedSet?.name },
                { label: "Number", value: detail.number },
                { label: "Rarity", value: detail.rarity },
              ],
            }}
            showMarketIntel={franchise === "pokemon"}
            variant="sheet"
            hideTitle
          />
        ) : null}
      </CatalogCardDetailSheet>
    </div>
  );
}
