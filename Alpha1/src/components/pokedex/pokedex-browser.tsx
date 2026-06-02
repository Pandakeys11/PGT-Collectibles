"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, LineChart, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useCatalogAmbientOptional } from "@/components/effects/catalog-ambient-provider";
import { CatalogSetTileGrid } from "@/components/catalog/catalog-set-tile-grid";
import { tcgSetToTileModel } from "@/components/catalog/catalog-set-tile";
import { useCatalogMobileLayout } from "@/hooks/use-catalog-mobile-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  releaseYearFromApiDate,
  type TcgCardSummary,
  type TcgPaginated,
  type TcgSetSummary,
} from "@/lib/pokedex/tcg-api-types";
import {
  SET_ERA_DESCRIPTION,
  SET_ERA_LABEL,
  SET_ERA_ORDER,
  setEraToOrderBy,
  type SetEraId,
} from "@/lib/pokedex/set-era";
import {
  CatalogFinishFilterTabs,
  CatalogPrintingPresetTabs,
  CatalogRarityFilterTabs,
} from "@/components/catalog/binder/catalog-binder-filter-tabs";
import { PokemonCatalogBinder } from "@/components/catalog/binder/pokemon-catalog-binder";
import { CatalogVariantImage } from "@/components/pokedex/catalog-variant-image";
import { useBinderSetCards } from "@/hooks/use-binder-set-cards";
import { CatalogSetBinderInsightPanel } from "@/components/catalog/catalog-set-binder-insight-panel";
import { CatalogSetHeaderBand } from "@/components/catalog/catalog-set-header-band";
import {
  CATALOG_CARD_SORT_OPTIONS,
  type CatalogCardSortId,
} from "@/lib/catalog/catalog-card-sort";
import { catalogRawFmvSeedFromCard } from "@/lib/catalog/catalog-card-fmv-seed";
import { formatPokemonCatalogSkuLabel } from "@/lib/catalog/parse-catalog-sku";
import {
  CatalogCardDetailActions,
  CatalogCardDetailBody,
  type CatalogCardDetailIdentity,
} from "@/components/catalog/catalog-card-detail-body";
import { CatalogCardDetailSheet } from "@/components/catalog/catalog-card-detail-sheet";
import { marketPokemonHref } from "@/lib/app-routes";
import { ScanThisCardButton } from "@/components/pokedex/scan-this-card-button";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { CatalogMarketIntelligenceRail } from "@/components/catalog/catalog-market-intelligence-rail";
import { CatalogSetInsightRail } from "@/components/catalog/catalog-set-insight-rail";
import { PokedexSetOverviewPanel } from "@/components/pokedex/pokedex-set-overview-panel";
import { hasCatalogSetOverlay } from "@/lib/pokedex/catalog-set-overlay";
import { printingPresetLabel } from "@/lib/pokedex/printing-presets";
import { catalogVariantLabelForCard } from "@/lib/scan/print-identity-ui";
import { getCatalogPromoSpecialRow } from "@/lib/pokedex/catalog-promo-special-sets";
import {
  getCatalogVariantArtworkGuardRailsUrl,
  resolveCatalogCardImages,
  type CatalogVariantOverlayByCardId,
} from "@/lib/pokedex/catalog-variant-artwork";
import { isLegendaryCollectionCatalogExpand } from "@/lib/pokedex/legendary-collection-catalog";
import { RARITY_TAB_LABELS, type RarityBucketId } from "@/lib/pokedex/rarity-buckets";
import {
  CATALOG_FINISH_TAB_LABELS,
  printingPresetMarketSuffix,
  printingPresetTabs,
  supportsFinishTabs,
  supportsPrintingPresets,
  type CatalogFinishBucketId,
  type PrintingPresetId,
} from "@/lib/pokedex/set-catalog-config";
import { fetchCatalogJson, readCatalogCache } from "@/lib/catalog/catalog-fetch-cache";
import { prefetchImageUrls } from "@/lib/ui/image-prefetch";
import { cn } from "@/lib/cn";

const CATALOG_GUARD_RAILS_URL = getCatalogVariantArtworkGuardRailsUrl();

function preferDistinctCurated(api: string | undefined, resolved: string | undefined): string | undefined {
  if (!resolved?.trim()) return undefined;
  if (!api?.trim()) return resolved;
  return resolved.trim() !== api.trim() ? resolved : undefined;
}

export function PokedexBrowser({
  scanTargetPath,
  onScanPrefill,
  embedded = false,
}: {
  scanTargetPath?: string;
  /** In-app handoff (e.g. Liquid Scan chat) — skips route navigation. */
  onScanPrefill?: (prefill: CatalogScanPrefill) => void;
  /** Compact layout for chat output panels. */
  embedded?: boolean;
} = {}) {
  const catalogAmbient = useCatalogAmbientOptional();
  const [setEra, setSetEra] = useState<SetEraId>("modern");
  const [setQuery, setSetQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [setsPage, setSetsPage] = useState(1);
  const [sets, setSets] = useState<TcgSetSummary[]>([]);
  const [setsMeta, setSetsMeta] = useState({ totalCount: 0, pageSize: 40, count: 0 });
  const [setsLoading, setSetsLoading] = useState(true);
  const [setsError, setSetsError] = useState<string | null>(null);

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedSetName, setSelectedSetName] = useState<string | null>(null);
  const [selectedSetSnapshot, setSelectedSetSnapshot] = useState<TcgSetSummary | null>(null);
  const [rarityBucket, setRarityBucket] = useState<RarityBucketId>("all");
  const [finishBucket, setFinishBucket] = useState<CatalogFinishBucketId>("all");
  const [printingPreset, setPrintingPreset] = useState<PrintingPresetId>("catalog");
  const [rarityCounts, setRarityCounts] = useState<Record<RarityBucketId, number> | null>(null);
  const [rarityCountsLoading, setRarityCountsLoading] = useState(false);
  const [cardSort, setCardSort] = useState<CatalogCardSortId>("number");
  const {
    cards,
    loading: cardsLoading,
    error: cardsError,
    totalCount: cardsTotalCount,
  } = useBinderSetCards({
    setId: selectedSetId,
    rarityBucket,
    finishBucket,
    printingPreset,
    cardSort,
    enabled: Boolean(selectedSetId),
  });

  const [detail, setDetail] = useState<TcgCardSummary | null>(null);
  const [variantArtworkOverlay, setVariantArtworkOverlay] = useState<CatalogVariantOverlayByCardId | null>(null);

  const printingMarketSuffix = useMemo(
    () => printingPresetMarketSuffix(selectedSetId, printingPreset),
    [selectedSetId, printingPreset],
  );

  const detailMarketPrintingHint = useMemo(() => {
    const parts = [
      printingMarketSuffix,
      detail?.catalogFinish === "reverse_holo" ? "Reverse Holo" : null,
    ].filter(Boolean) as string[];
    return parts.length ? parts.join(" ") : null;
  }, [detail?.catalogFinish, printingMarketSuffix]);

  const detailResolvedImages = useMemo(() => {
    if (!detail || !selectedSetId) return null;
    return resolveCatalogCardImages({
      setId: selectedSetId,
      card: detail,
      printingPreset,
      overlay: variantArtworkOverlay,
    });
  }, [detail, selectedSetId, printingPreset, variantArtworkOverlay]);

  const printingPresetOptionsList = useMemo(() => {
    if (!selectedSetId || !supportsPrintingPresets(selectedSetId)) return null;
    return printingPresetTabs(selectedSetId);
  }, [selectedSetId]);

  useEffect(() => {
    setFinishBucket("all");
    setPrintingPreset("catalog");
  }, [selectedSetId]);

  useEffect(() => {
    setSetsPage(1);
    setSelectedSetId(null);
    setSelectedSetName(null);
    setSelectedSetSnapshot(null);
    setDetail(null);
  }, [setEra]);

  useEffect(() => {
    if (!detail?.id || detail.images?.large) return;
    let cancelled = false;
    void fetch(`/api/pokedex/card?id=${encodeURIComponent(detail.id)}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as { card?: TcgCardSummary };
        if (!r.ok || !body.card) return null;
        return body.card;
      })
      .then((full) => {
        if (cancelled || !full) return;
        setDetail((prev) =>
          prev?.id === full.id
            ? {
                ...prev,
                ...full,
                set: full.set ?? prev.set,
                images: {
                  small: full.images?.small ?? prev.images?.small,
                  large: full.images?.large ?? prev.images?.large ?? full.images?.small,
                },
              }
            : prev,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [detail?.id, detail?.images?.large]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = setQuery.trim();
      setDebouncedQ(q ? `name:*${q}*` : "");
      setSetsPage(1);
    }, 320);
    return () => window.clearTimeout(t);
  }, [setQuery]);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({
      page: String(setsPage),
      pageSize: "40",
      orderBy: setEraToOrderBy(setEra),
      era: setEra,
    });
    if (debouncedQ) q.set("q", debouncedQ);
    const url = `/api/pokedex/sets?${q}`;

    const cached = readCatalogCache<TcgPaginated<TcgSetSummary>>(url);
    if (cached) {
      setSets(cached.data);
      setSetsMeta({
        totalCount: cached.totalCount,
        pageSize: cached.pageSize,
        count: cached.count,
      });
      setSetsLoading(false);
    } else {
      setSetsLoading(true);
    }
    setSetsError(null);

    void fetchCatalogJson<TcgPaginated<TcgSetSummary>>(url)
      .then((payload) => {
        if (cancelled) return;
        setSets(payload.data);
        setSetsMeta({
          totalCount: payload.totalCount,
          pageSize: payload.pageSize,
          count: payload.count,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled && !cached) {
          setSetsError(e instanceof Error ? e.message : "Failed to load sets");
        }
      })
      .finally(() => {
        if (!cancelled) setSetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setsPage, debouncedQ, setEra]);

  useEffect(() => {
    if (!selectedSetId) {
      setRarityCounts(null);
      setRarityCountsLoading(false);
      return;
    }
    let cancelled = false;
    const url = `/api/pokedex/cards/rarity-counts?setId=${encodeURIComponent(selectedSetId)}`;
    const cached = readCatalogCache<{ counts: Record<RarityBucketId, number> }>(url);
    if (cached) {
      setRarityCounts(cached.counts);
      setRarityCountsLoading(false);
    } else {
      setRarityCountsLoading(true);
      setRarityCounts(null);
    }
    void fetchCatalogJson<{ counts: Record<RarityBucketId, number> }>(url)
      .then((payload) => {
        if (!cancelled) setRarityCounts(payload.counts);
      })
      .catch(() => {
        if (!cancelled) setRarityCounts(null);
      })
      .finally(() => {
        if (!cancelled) setRarityCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSetId]);

  useEffect(() => {
    if (!selectedSetId) {
      setVariantArtworkOverlay(null);
      return;
    }
    let cancelled = false;
    setVariantArtworkOverlay(null);
    const url = `/api/pokedex/variant-artwork-overlay?setId=${encodeURIComponent(selectedSetId)}`;
    const cached = readCatalogCache<{ cards?: CatalogVariantOverlayByCardId }>(url);
    if (cached?.cards && Object.keys(cached.cards).length > 0) {
      setVariantArtworkOverlay(cached.cards);
    }
    void fetch(url)
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as {
          cards?: CatalogVariantOverlayByCardId;
          error?: string;
        };
        if (!r.ok) throw new Error(body.error || `Overlay failed (${r.status})`);
        return body.cards;
      })
      .then((cards) => {
        if (cancelled) return;
        if (cards && typeof cards === "object" && Object.keys(cards).length > 0) {
          setVariantArtworkOverlay(cards);
        } else {
          setVariantArtworkOverlay(null);
        }
      })
      .catch(() => {
        if (!cancelled) setVariantArtworkOverlay(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSetId]);

  useEffect(() => {
    prefetchImageUrls(
      cards.map((c) => c.images?.small ?? c.images?.large),
      96,
    );
  }, [cards]);

  useEffect(() => {
    prefetchImageUrls(
      sets.map((s) => s.images?.logo),
      48,
    );
  }, [sets]);

  const onRarityTabChange = useCallback((bucket: RarityBucketId) => {
    setRarityBucket(bucket);
    setFinishBucket("all");
  }, []);

  const onFinishTabChange = useCallback((finish: CatalogFinishBucketId) => {
    setFinishBucket(finish);
  }, []);

  const onPrintingPresetChange = useCallback((preset: PrintingPresetId) => {
    setPrintingPreset(preset);
  }, []);

  const binderFilterChrome = useMemo(() => {
    if (!selectedSetId) return null;
    return (
      <>
        <CatalogRarityFilterTabs
          value={rarityBucket}
          counts={rarityCounts}
          countsLoading={rarityCountsLoading}
          onChange={onRarityTabChange}
        />
        {supportsFinishTabs(selectedSetId) ? (
          <CatalogFinishFilterTabs value={finishBucket} onChange={onFinishTabChange} />
        ) : null}
        {printingPresetOptionsList ? (
          <CatalogPrintingPresetTabs
            options={printingPresetOptionsList}
            value={printingPreset}
            onChange={onPrintingPresetChange}
          />
        ) : null}
      </>
    );
  }, [
    selectedSetId,
    rarityBucket,
    rarityCounts,
    rarityCountsLoading,
    onRarityTabChange,
    finishBucket,
    onFinishTabChange,
    printingPresetOptionsList,
    printingPreset,
    onPrintingPresetChange,
  ]);

  const selectSet = useCallback((s: TcgSetSummary) => {
    setSelectedSetId(s.id);
    setSelectedSetName(s.name);
    setSelectedSetSnapshot(s);
    setRarityBucket("all");
    setFinishBucket("all");
    setPrintingPreset("catalog");
    setDetail(null);
  }, []);

  const setsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(setsMeta.totalCount / setsMeta.pageSize)),
    [setsMeta.totalCount, setsMeta.pageSize],
  );

  const catalogScanPrefill = useMemo((): CatalogScanPrefill | null => {
    if (!detail) return null;
    const setName =
      detail.set?.name ?? selectedSetSnapshot?.name ?? selectedSetName ?? undefined;
    const printParts = [
      detailMarketPrintingHint,
      detail.catalogFinish === "reverse_holo" ? "Reverse Holo" : null,
    ].filter(Boolean) as string[];
    return {
      franchise: "pokemon",
      catalogId: detail.id,
      name: detail.name,
      set: setName,
      number: detail.number,
      year: releaseYearFromApiDate(detail.set?.releaseDate ?? selectedSetSnapshot?.releaseDate) ?? undefined,
      rarity: detail.rarity,
      printStamps: printParts.length ? printParts.join(" ") : undefined,
      catalogImageUrl:
        preferDistinctCurated(
          detail.images?.small ?? detail.images?.large,
          detailResolvedImages?.small ?? detailResolvedImages?.large,
        ) ?? detail.images?.small,
    };
  }, [
    detail,
    detailMarketPrintingHint,
    detailResolvedImages?.large,
    detailResolvedImages?.small,
    selectedSetName,
    selectedSetSnapshot,
  ]);

  const mobileStepped = useCatalogMobileLayout(embedded);
  /** Embedded mobile: stepped sets → set; parent workspace scroll. */
  const mobileSetStack = embedded && mobileStepped;
  /** Master catalog (Liquid Scan): set insights + filters + binder in one stack. */
  const embeddedSetBinder = embedded && Boolean(selectedSetId);
  /** Embedded: sets full-width until a set is picked; then split (desktop) or cards-only (mobile). */
  const showSetsPane = !embedded || !selectedSetId;
  const showCardsPane = !embedded || Boolean(selectedSetId);
  const embeddedSetOpen = embedded && Boolean(selectedSetId);

  const openCardDetailByCatalogId = useCallback(
    (catalogId: string) => {
      const card = cards.find((c) => c.id === catalogId);
      if (card) setDetail(card);
    },
    [cards],
  );

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
    catalogAmbient?.setFocusSetId(selectedSetId);
  }, [catalogAmbient, selectedSetId]);

  const setTiles = useMemo(
    () =>
      sets.map((s) => {
        const promo = getCatalogPromoSpecialRow(s.id);
        return {
          ...tcgSetToTileModel(s),
          badge: promo ? (promo.bucket === "promo" ? "Promo" : "Special") : null,
        };
      }),
    [sets],
  );

  const catalogDetailIdentity = useMemo((): CatalogCardDetailIdentity | null => {
    if (!detail) return null;
    const fromCard = detail.set;
    const snap = selectedSetSnapshot;
    const setName = fromCard?.name ?? snap?.name ?? selectedSetName;
    const series = fromCard?.series ?? snap?.series;
    const releaseDate = fromCard?.releaseDate ?? snap?.releaseDate;
    const releaseYear = releaseYearFromApiDate(releaseDate);
    const printed =
      fromCard?.printedTotal ?? snap?.printedTotal ?? fromCard?.total ?? snap?.total;
    const cardsInSet =
      printed != null && Number.isFinite(printed) ? String(printed) : null;

    const subtitle = [
      setName,
      detail.number ? `#${detail.number}` : null,
      detail.rarity,
      releaseYear,
    ]
      .filter(Boolean)
      .join(" · ");

    const badges = (
      <>
        {detail.catalogFinish === "reverse_holo" ? (
          <span className="inline-flex rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-300">
            Reverse holofoil
          </span>
        ) : null}
        {printingPreset !== "catalog" && printingMarketSuffix ? (
          <span className="inline-flex rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
            Comps: {printingMarketSuffix}
          </span>
        ) : null}
      </>
    );

    const printRunLabel = catalogVariantLabelForCard({
      catalogId: detail.id,
      catalogVariantKey: detail.catalogVariantKey,
      catalogVariantLabel: detail.catalogVariantLabel,
      printingPresetLabel:
        printingPreset !== "catalog" ? printingPresetLabel(printingPreset) : null,
    });

    const image =
      detail.images?.large || detail.images?.small || detailResolvedImages?.small ? (
        <CatalogVariantImage
          apiSrc={detail.images?.large ?? detail.images?.small}
          preferredSrc={preferDistinctCurated(
            detail.images?.large ?? detail.images?.small,
            detailResolvedImages?.large ?? detailResolvedImages?.small,
          )}
          alt={detail.name}
          priority
          className="h-full w-full object-contain"
        />
      ) : null;

    return {
      catalogId: detail.id,
      name: detail.name,
      subtitle,
      image,
      badges,
      initialRawFmv: catalogRawFmvSeedFromCard(detail),
      extraRows: [
        {
          label: "Catalog SKU",
          value: formatPokemonCatalogSkuLabel(detail.id, detail.number),
        },
        { label: "Print run", value: printRunLabel },
        {
          label: "Finish",
          value:
            detail.catalogFinish === "reverse_holo"
              ? "Reverse Holo"
              : null,
        },
        { label: "Series", value: series },
        { label: "Released", value: releaseDate },
        { label: "Cards in set", value: cardsInSet },
        { label: "HP", value: detail.hp ? `${detail.hp} HP` : null },
        { label: "Type", value: detail.supertype },
        {
          label: "Subtypes",
          value: detail.subtypes?.length ? detail.subtypes.join(", ") : null,
        },
        { label: "Artist", value: detail.artist },
      ],
    };
  }, [
    detail,
    detailResolvedImages?.large,
    detailResolvedImages?.small,
    printingMarketSuffix,
    printingPreset,
    selectedSetName,
    selectedSetSnapshot,
  ]);

  return (
    <div
      className={cn(
        "relative min-w-0 max-w-full overflow-x-hidden",
        embedded &&
          "liquid-catalog-embed flex min-h-0 flex-col text-slate-200 max-lg:flex-none max-lg:overflow-visible lg:flex-1",
        embeddedSetOpen && "sc-catalog-set-view-open",
      )}
    >
      <div className={cn("mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col", !embedded && "max-w-[1600px]")}>
        {embedded ? null : (
        <p className="text-xs leading-relaxed text-muted">
          Card data from{" "}
          <a
            href="https://pokemontcg.io/"
            className="text-accent underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Pokémon TCG API
          </a>
          {CATALOG_GUARD_RAILS_URL ? (
            <>
              {" "}
              ·{" "}
              <a
                href={CATALOG_GUARD_RAILS_URL}
                className="text-accent underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                Set release timeline
              </a>
            </>
          ) : null}
          .
        </p>
        )}

        {!embedded ? (
        <div className="mt-4 flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-accent" aria-hidden />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">Browse sets & cards</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Browse sets by era — <strong className="font-medium text-secondary">Vintage</strong>,{" "}
              <strong className="font-medium text-secondary">Mid-Era</strong>, or{" "}
              <strong className="font-medium text-secondary">Modern</strong> — then open a chapter to inspect cards,
              rarities, and links from the API.
            </p>
          </div>
        </div>
        ) : null}

        <div
          className={cn(
            "sc-pokedex-catalog-grid min-h-0 gap-3",
            embedded
              ? cn(
                  "mt-1 flex min-h-0 flex-col max-lg:flex-none max-lg:overflow-visible lg:flex-1 lg:overflow-hidden",
                  embeddedSetOpen &&
                    "sc-pokedex-catalog-grid--set-open max-lg:[&>*]:max-h-none lg:grid lg:max-h-full lg:grid-cols-1 lg:grid-rows-1 lg:items-stretch lg:gap-0 [&>*]:min-h-0 lg:[&>*]:max-h-full",
                  !embeddedSetOpen && selectedSetId === null && "lg:grid lg:grid-cols-1",
                )
              : "mt-8 grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-4",
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
                  placeholder="Search set name…"
                  className={cn(
                    embedded ? "h-9 pl-9 text-[11px] lg:h-10 lg:pl-10 lg:text-sm" : "pl-9",
                  )}
                  aria-label="Search sets"
                />
              </div>
              <div
                className={cn(
                  "grid shrink-0 grid-cols-3 gap-0.5 rounded-lg border border-border-subtle bg-panel-raised/40 p-0.5",
                  embedded ? "lg:min-w-[11.5rem] lg:gap-1 lg:rounded-xl lg:p-1" : "gap-1 rounded-xl p-1",
                )}
                role="group"
                aria-label="Filter sets by era"
              >
                {SET_ERA_ORDER.map((era) => {
                  const active = setEra === era;
                  return (
                    <button
                      key={era}
                      type="button"
                      title={SET_ERA_DESCRIPTION[era]}
                      aria-pressed={active}
                      onClick={() => {
                        setSetEra(era);
                        setSetsPage(1);
                      }}
                      className={cn(
                        "rounded-md px-1 py-1.5 text-center font-semibold leading-tight transition touch-manipulation",
                        embedded
                          ? "text-[10px] lg:rounded-lg lg:px-2 lg:py-2 lg:text-xs"
                          : "rounded-lg px-1.5 py-2 text-[10px] sm:px-2 sm:text-xs",
                        active
                          ? "bg-accent text-canvas shadow-sm"
                          : "text-muted hover:bg-panel-raised hover:text-primary",
                      )}
                    >
                      {SET_ERA_LABEL[era]}
                    </button>
                  );
                })}
              </div>
            </div>
            {!embedded ? (
              <p className="mt-2 text-[10px] leading-snug text-muted sm:text-[11px]">
                {SET_ERA_DESCRIPTION[setEra]}
              </p>
            ) : null}

            <div className="mt-2.5 flex min-h-0 flex-1 flex-col overflow-hidden">
              <CatalogSetTileGrid
                className="h-full min-h-0"
                sets={setTiles}
                selectedSetId={selectedSetId}
                onSelect={(tile) => {
                  const hit = sets.find((s) => s.id === tile.id);
                  if (hit) selectSet(hit);
                }}
                loading={setsLoading}
                error={setsError}
                density={embedded && embeddedSetOpen ? "sidebar" : embedded ? "browse" : "full"}
                emptyMessage={`No ${SET_ERA_LABEL[setEra].toLowerCase()} sets match your search.`}
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
              "sc-catalog-card-pane desk-surface-raised flex h-full min-h-0 flex-col overflow-hidden",
              embedded
                ? "min-h-0 flex-1 p-2.5 sc-glass-raised !border-white/8 lg:p-3"
                : selectedSetId
                  ? "min-h-0 flex-1 p-4 sm:p-5 lg:min-h-[calc(100dvh-10rem)]"
                  : "min-h-[50dvh] p-4 sm:p-5 lg:min-h-[calc(100dvh-10rem)]",
            )}
          >
            {!selectedSetId ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden px-4 py-8 text-center">
                <div className="rounded-2xl border border-dashed border-amber-400/25 bg-amber-400/[0.04] px-6 py-8">
                  <p className="text-sm font-medium text-slate-300">Choose a set</p>
                  <p className="mt-1.5 max-w-xs text-pretty text-xs leading-relaxed text-slate-500">
                    Pick a set from the gallery{embedded && mobileStepped ? "" : " on the left"} to browse cards,
                    rarities, and scan into your session.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "sc-catalog-set-body flex flex-col",
                  embeddedSetBinder
                    ? "sc-catalog-set-body--binder min-h-0 flex-1 flex-col overflow-hidden"
                    : "min-h-0 flex-1 flex-col overflow-hidden",
                )}
              >
                {embedded && mobileStepped ? (
                  <div className="sc-catalog-set-mobile-toolbar mb-1.5 flex shrink-0 items-center gap-2 border-b border-border-subtle/70 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSetId(null);
                        setSelectedSetName(null);
                        setSelectedSetSnapshot(null);
                        setDetail(null);
                      }}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 text-xs font-medium text-amber-300/95 touch-manipulation hover:bg-white/5 hover:text-amber-200"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Sets
                    </button>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold text-primary">{selectedSetName}</h2>
                      <p className="truncate text-[10px] text-muted">
                        {rarityBucket === "all"
                          ? `${cardsTotalCount} cards`
                          : `${cardsTotalCount} ${RARITY_TAB_LABELS[rarityBucket]}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={cn(
                        "flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border-subtle",
                        embedded && embeddedSetOpen ? "pb-1.5" : "pb-3",
                      )}
                    >
                      <div className="min-w-0">
                        <h2
                          className={cn(
                            "font-semibold text-primary",
                            embedded && embeddedSetOpen ? "text-sm" : "text-lg",
                          )}
                        >
                          {selectedSetName}
                        </h2>
                        <p className="mt-0.5 text-xs text-muted">
                          {rarityBucket === "all"
                            ? `${cardsTotalCount} cards`
                            : `${cardsTotalCount} ${RARITY_TAB_LABELS[rarityBucket]} cards`}
                          {selectedSetId && supportsFinishTabs(selectedSetId) && finishBucket !== "all"
                            ? ` · ${CATALOG_FINISH_TAB_LABELS[finishBucket]}`
                            : ""}
                          {selectedSetId && isLegendaryCollectionCatalogExpand(selectedSetId)
                            ? " · Standard and reverse holofoil variants"
                            : variantArtworkOverlay && supportsPrintingPresets(selectedSetId)
                              ? " · Curated print artwork where available"
                              : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedSetId(null);
                          setSelectedSetName(null);
                          setSelectedSetSnapshot(null);
                        }}
                      >
                        Clear
                      </Button>
                    </div>

                    {selectedSetId &&
                    selectedSetName &&
                    !(embedded && embeddedSetOpen) &&
                    !embeddedSetBinder ? (
                      <CatalogSetHeaderBand
                        setId={selectedSetId}
                        setName={selectedSetName}
                        cardSort={cardSort}
                        onCardSortChange={setCardSort}
                        onSelectChase={(catalogId) => {
                          const hit = cards.find((c) => c.id === catalogId);
                          if (hit) setDetail(hit);
                        }}
                        className="mt-2 shrink-0"
                      />
                    ) : null}
                  </>
                )}

                <div
                  className={cn(
                    embeddedSetBinder &&
                      "sc-catalog-set-binder-layout sc-catalog-set-binder-layout--split min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain scanner-chat-scrollbar touch-pan-y lg:grid lg:overflow-hidden lg:touch-auto",
                    !embeddedSetBinder &&
                      (mobileSetStack
                        ? "sc-catalog-set-mobile-stack min-h-0 flex-1 overflow-y-auto overscroll-contain scanner-chat-scrollbar touch-pan-y"
                        : "flex min-h-0 flex-1 flex-col overflow-hidden"),
                  )}
                >
                  {embeddedSetBinder && selectedSetId && selectedSetName ? (
                    <aside className="sc-catalog-set-binder-rail max-lg:contents lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overscroll-contain lg:scanner-chat-scrollbar lg:pr-0.5">
                      <CatalogSetBinderInsightPanel
                        setId={selectedSetId}
                        setName={selectedSetName}
                        cards={cards}
                        cardSort={cardSort}
                        onCardSortChange={setCardSort}
                        onSelectCard={openCardDetailByCatalogId}
                        onSelectChase={(catalogId) => {
                          const hit = cards.find((c) => c.id === catalogId);
                          if (hit) setDetail(hit);
                        }}
                        className="shrink-0"
                      />
                    </aside>
                  ) : null}

                {!embedded && selectedSetId && selectedSetName && hasCatalogSetOverlay(selectedSetId) ? (
                  <div className="mt-3 shrink-0">
                    <PokedexSetOverviewPanel setId={selectedSetId} setName={selectedSetName} />
                  </div>
                ) : null}

                <div
                  className={cn(
                    embeddedSetBinder &&
                      "sc-catalog-set-binder-stage max-lg:contents lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col lg:overflow-hidden",
                  )}
                >
                  <div
                    className={cn(
                      "sc-catalog-cards-scroll flex flex-col overflow-x-hidden pt-1.5 lg:pt-0",
                      selectedSetId && "sc-catalog-cards-scroll--binder",
                      embeddedSetBinder && "sc-catalog-cards-scroll--in-binder-stack",
                      !embeddedSetBinder && !embedded && "min-h-0 flex-1 overflow-y-auto overscroll-contain scanner-chat-scrollbar touch-pan-y",
                      !embeddedSetBinder && embedded && "lg:min-h-0 lg:flex-1",
                    )}
                  >
                    {selectedSetId && selectedSetName ? (
                      <PokemonCatalogBinder
                        cards={cards}
                        loading={cardsLoading}
                        error={cardsError}
                        setId={selectedSetId}
                        setName={selectedSetName}
                        printingPreset={printingPreset}
                        variantArtworkOverlay={variantArtworkOverlay}
                        onSelectCard={setDetail}
                        embedded={embedded}
                        filterChrome={binderFilterChrome}
                      />
                    ) : null}
                  </div>
                </div>
                </div>
              </div>
            )}
          </Card>
          ) : null}

          {embeddedSetOpen && selectedSetId && selectedSetName && !embedded ? (
            <div className="sc-catalog-set-rails hidden min-h-0 flex-col gap-2 overflow-hidden lg:flex">
              <CatalogMarketIntelligenceRail
                setId={selectedSetId}
                setName={selectedSetName}
                cards={cards}
                onSelectCard={openCardDetailByCatalogId}
                className="max-h-[min(32%,220px)] shrink-0"
              />
              <CatalogSetInsightRail
                setId={selectedSetId}
                setName={selectedSetName}
                cards={cards}
                onSelectCard={openCardDetailByCatalogId}
                className="min-h-0 flex-1 overflow-hidden rounded-xl"
              />
            </div>
          ) : null}
        </div>
      </div>

      {detail ? (
        <CatalogCardDetailSheet
          open
          onClose={() => setDetail(null)}
          title={detail.name}
          subtitle={null}
          footer={
            <CatalogCardDetailActions>
              {catalogScanPrefill ? (
                <ScanThisCardButton
                  prefill={catalogScanPrefill}
                  className="w-full sm:flex-1"
                  targetPath={scanTargetPath}
                  onScan={onScanPrefill}
                />
              ) : null}
              <Button size="sm" variant="secondary" className="w-full sm:flex-1" asChild>
                <Link href={marketPokemonHref(detail.id)}>
                  <LineChart className="mr-1.5 h-4 w-4" aria-hidden />
                  Market intel
                </Link>
              </Button>
              {detail.tcgplayer?.url ? (
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" asChild>
                  <a href={detail.tcgplayer.url} target="_blank" rel="noreferrer">
                    TCGPlayer
                  </a>
                </Button>
              ) : null}
            </CatalogCardDetailActions>
          }
        >
          {catalogDetailIdentity ? (
            <CatalogCardDetailBody identity={catalogDetailIdentity} variant="sheet" hideTitle />
          ) : null}
        </CatalogCardDetailSheet>
      ) : null}
    </div>
  );
}
