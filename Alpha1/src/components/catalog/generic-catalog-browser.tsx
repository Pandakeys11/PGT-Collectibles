"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LineChart, Loader2, Search } from "lucide-react";
import { marketPokemonHref } from "@/lib/app-routes";
import { CatalogCardDetailSheet } from "@/components/catalog/catalog-card-detail-sheet";
import {
  CatalogCardDetailActions,
  CatalogCardDetailBody,
} from "@/components/catalog/catalog-card-detail-body";
import { CatalogSetTileGrid } from "@/components/catalog/catalog-set-tile-grid";
import type { CatalogSetTileModel } from "@/components/catalog/catalog-set-tile";
import { CatalogFocusGrid } from "@/components/pokedex/catalog-focus-grid";
import { useCatalogMobileLayout } from "@/hooks/use-catalog-mobile-layout";
import { ScanThisCardButton } from "@/components/pokedex/scan-this-card-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    ? "h-9 rounded-md border-white/10 bg-white/[0.04] pl-9 text-[11px] text-slate-100 placeholder:text-slate-600 lg:h-10 lg:pl-10 lg:text-sm"
    : "h-10 pl-9";

  const setTiles: CatalogSetTileModel[] = sets.map((set) => ({
    id: set.id,
    name: set.name,
    series: set.series ?? null,
    releaseDate: set.releaseDate ?? null,
    year: set.year ?? null,
    total: set.total ?? null,
    printedTotal: set.printedTotal ?? set.total ?? null,
    images: set.images,
  }));

  const setsTotalPages = Math.max(1, Math.ceil(setsMeta.totalCount / setsMeta.pageSize));
  const cardsTotalPages = Math.max(1, Math.ceil(cardsMeta.totalCount / cardsMeta.pageSize));

  const showSetsPane = !embedded || !selectedSet;
  const showCardsPane = !embedded || Boolean(selectedSet);
  const embeddedSetOpen = embedded && Boolean(selectedSet);

  return (
    <div
      className={cn(
        "relative min-w-0 max-w-full overflow-x-hidden",
        embedded && "liquid-catalog-embed text-slate-200",
      )}
    >
      <div className={cn("mx-auto max-w-full", !embedded && "max-w-[1600px]")}>
        {!embedded ? (
          <p className="text-[11px] text-muted">{syncHint}</p>
        ) : null}

        <div
          className={cn(
            "sc-pokedex-catalog-grid min-h-0 gap-3",
            embedded
              ? cn(
                  "mt-0 flex min-h-0 flex-1 flex-col overflow-hidden",
                  embeddedSetOpen &&
                    "sc-pokedex-catalog-grid--set-open lg:grid lg:max-h-full lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:grid-rows-1 lg:items-stretch lg:gap-3 [&>*]:min-h-0 [&>*]:max-h-full",
                  !embeddedSetOpen && !selectedSet && "lg:grid lg:grid-cols-1",
                )
              : "mt-6 grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-5",
          )}
        >
          {showSetsPane ? (
            <Card
              className={cn(
                "desk-surface-raised flex h-full min-h-0 flex-col overflow-hidden",
                embedded
                  ? "min-h-0 flex-1 p-2.5 sc-glass-raised !border-white/8 lg:p-3"
                  : "max-h-[70dvh] p-4 sm:max-h-none sm:p-5 lg:max-h-[calc(100dvh-10rem)]",
              )}
            >
              {embedded ? null : (
                <p className="mb-2 text-[10px] leading-snug text-muted sm:text-[11px]">{syncHint}</p>
              )}
              <div
                className={cn(
                  "flex shrink-0 flex-col gap-2",
                  embedded ? "lg:flex-row lg:items-stretch lg:gap-2.5" : "sm:flex-row sm:items-center",
                )}
              >
                <div className="relative min-w-0 flex-1">
                  <Search
                    className={cn(
                      "pointer-events-none absolute top-1/2 -translate-y-1/2 text-faint",
                      embedded ? "left-2.5 h-3.5 w-3.5 lg:left-3 lg:h-4 lg:w-4" : "left-2.5 h-4 w-4",
                    )}
                  />
                  <Input
                    value={setQuery}
                    onChange={(e) => setSetQuery(e.target.value)}
                    placeholder={`Search ${meta.label} sets…`}
                    className={inputClass}
                    aria-label={`Search ${meta.label} sets`}
                  />
                </div>
              </div>

              <div className="mt-2.5 flex min-h-0 flex-1 flex-col overflow-hidden">
                <CatalogSetTileGrid
                  className="h-full min-h-0"
                  sets={setTiles}
                  selectedSetId={selectedSet?.id ?? null}
                  onSelect={(tile) => {
                    const hit = sets.find((s) => s.id === tile.id);
                    if (hit) selectSet(hit);
                  }}
                  loading={setsLoading}
                  error={setsError}
                  compact={embedded}
                  emptyMessage="No sets yet. Run catalog sync or wait for the nightly job."
                  page={setsPage}
                  totalPages={setsTotalPages}
                  totalCount={setsMeta.totalCount}
                  pagingDisabled={setsLoading}
                  onPrevPage={() => setSetsPage((p) => Math.max(1, p - 1))}
                  onNextPage={() => setSetsPage((p) => p + 1)}
                />
              </div>
            </Card>
          ) : null}

          {showCardsPane ? (
            <Card
              className={cn(
                "desk-surface-raised flex h-full min-h-0 flex-col overflow-hidden",
                embedded
                  ? "min-h-0 flex-1 p-2.5 sc-glass-raised !border-white/8 lg:p-3"
                  : "min-h-[50dvh] p-4 sm:p-5 lg:min-h-[calc(100dvh-10rem)]",
              )}
            >
              {!selectedSet ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-4 py-8 text-center">
                  <div className="rounded-2xl border border-dashed border-amber-400/25 bg-amber-400/[0.04] px-6 py-8">
                    <p className="text-sm font-medium text-slate-300">Choose a set</p>
                    <p className="mt-1.5 max-w-xs text-pretty text-xs leading-relaxed text-slate-500">
                      Pick a set from the gallery{embedded && mobileStepped ? "" : " on the left"} to browse cards
                      and scan into your session.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  {embedded && mobileStepped ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSet(null);
                        setDetail(null);
                      }}
                      className="mb-2 inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-medium text-amber-300/95 touch-manipulation hover:text-amber-200"
                    >
                      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                      All sets
                    </button>
                  ) : null}

                  <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border-subtle pb-3">
                    <div className="min-w-0">
                      <h2
                        className={cn(
                          "font-semibold text-primary",
                          embedded ? "text-sm lg:text-base" : "text-lg",
                        )}
                      >
                        {selectedSet.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted">
                        {cardsMeta.totalCount.toLocaleString()} cards
                        {selectedSet.series ? ` · ${selectedSet.series}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="relative mt-2 shrink-0">
                    <Search
                      className={cn(
                        "pointer-events-none absolute top-1/2 -translate-y-1/2 text-faint",
                        embedded ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4",
                      )}
                    />
                    <Input
                      value={cardQuery}
                      onChange={(e) => setCardQuery(e.target.value)}
                      placeholder="Filter cards in this set…"
                      className={inputClass}
                      aria-label="Filter cards in set"
                    />
                  </div>

                  <div className="sc-catalog-cards-scroll mt-2 min-h-0 flex-1 overflow-y-auto">
                    {cardsLoading ? (
                      <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                        Loading cards…
                      </p>
                    ) : cardsError ? (
                      <p className="p-4 text-sm text-danger">{cardsError}</p>
                    ) : cards.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted">
                        No cards loaded for this set yet.
                        {selectedSet.total != null && selectedSet.total > 0
                          ? " The nightly catalog sync may still be catching up."
                          : " This set may be unreleased or empty in the catalog source."}
                      </p>
                    ) : (
                      <>
                        <CatalogFocusGrid
                          items={cards}
                          className={cn(embedded && "gap-2.5 sm:grid-cols-3", mobileStepped && "grid-cols-2 gap-3")}
                          getKey={(c) => c.id}
                          renderItem={(card, { focused }) => (
                            <button
                              type="button"
                              onClick={() => setDetail(card)}
                              className={cn(
                                "w-full overflow-hidden rounded-xl border bg-[#070b10] text-left transition touch-manipulation",
                                detail?.id === card.id
                                  ? "border-amber-400/40 ring-1 ring-amber-400/25"
                                  : "border-white/10 hover:border-amber-200/25",
                                focused && "shadow-lg shadow-black/40",
                              )}
                            >
                              <div className="aspect-[2.5/3.5] w-full bg-black/40">
                                {card.images?.small ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={card.images.small}
                                    alt=""
                                    className="h-full w-full object-contain p-1"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[10px] text-faint">
                                    No image
                                  </div>
                                )}
                              </div>
                              <div className={cn("border-t border-white/8 px-2 py-1.5", embedded && "px-2.5 py-2")}>
                                <p
                                  className={cn(
                                    "truncate font-medium text-slate-100",
                                    embedded ? "text-xs" : "text-[10px]",
                                  )}
                                >
                                  {card.name}
                                </p>
                                <p className={cn("truncate text-slate-500", embedded ? "text-[11px]" : "text-[9px]")}>
                                  {[card.number, card.rarity].filter(Boolean).join(" · ")}
                                </p>
                              </div>
                            </button>
                          )}
                        />
                        {cardsTotalPages > 1 ? (
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-2 text-[10px] text-muted">
                            <span>
                              Page {cardsPage} / {cardsTotalPages}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={cardsPage <= 1 || cardsLoading}
                                onClick={() => setCardsPage((p) => Math.max(1, p - 1))}
                              >
                                Prev
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={cardsPage >= cardsTotalPages || cardsLoading}
                                onClick={() => setCardsPage((p) => p + 1)}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>

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
