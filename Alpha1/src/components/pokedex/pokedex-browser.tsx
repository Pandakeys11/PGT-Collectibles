"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, LineChart, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { CatalogEraFilter } from "@/components/catalog/catalog-era-filter";
import { CatalogSetTileGrid } from "@/components/catalog/catalog-set-tile-grid";
import { tcgSetToTileModel } from "@/components/catalog/catalog-set-tile";
import { useCatalogMobileLayout } from "@/hooks/use-catalog-mobile-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CatalogCardDetailSheet } from "@/components/catalog/catalog-card-detail-sheet";
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
  setEraToOrderBy,
  type SetEraId,
} from "@/lib/pokedex/set-era";
import { CatalogFocusGrid } from "@/components/pokedex/catalog-focus-grid";
import { CatalogVariantImage } from "@/components/pokedex/catalog-variant-image";
import {
  CatalogCardDetailActions,
  CatalogCardDetailBody,
  type CatalogCardDetailIdentity,
} from "@/components/catalog/catalog-card-detail-body";
import { marketPokemonHref } from "@/lib/app-routes";
import { ScanThisCardButton } from "@/components/pokedex/scan-this-card-button";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { CatalogSetInsightRail } from "@/components/catalog/catalog-set-insight-rail";
import { rollupSetInsightCards } from "@/lib/catalog/set-insight-utils";
import { PokedexSetOverviewPanel } from "@/components/pokedex/pokedex-set-overview-panel";
import { hasCatalogSetOverlay } from "@/lib/pokedex/catalog-set-overlay";
import { getCatalogPromoSpecialRow } from "@/lib/pokedex/catalog-promo-special-sets";
import {
  getCatalogVariantArtworkGuardRailsUrl,
  resolveCatalogCardImages,
  type CatalogVariantOverlayByCardId,
} from "@/lib/pokedex/catalog-variant-artwork";
import { isLegendaryCollectionCatalogExpand } from "@/lib/pokedex/legendary-collection-catalog";
import { RARITY_TAB_LABELS, RARITY_TAB_ORDER, type RarityBucketId } from "@/lib/pokedex/rarity-buckets";
import {
  CATALOG_FINISH_TAB_LABELS,
  CATALOG_FINISH_TAB_ORDER,
  printingPresetMarketSuffix,
  printingPresetTabs,
  supportsFinishTabs,
  supportsPrintingPresets,
  type CatalogFinishBucketId,
  type PrintingPresetId,
} from "@/lib/pokedex/set-catalog-config";
import { cn } from "@/lib/cn";

const CATALOG_PAGE_SIZE = 250;

const CATALOG_GUARD_RAILS_URL = getCatalogVariantArtworkGuardRailsUrl();

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function preferDistinctCurated(api: string | undefined, resolved: string | undefined): string | undefined {
  if (!resolved?.trim()) return undefined;
  if (!api?.trim()) return resolved;
  return resolved.trim() !== api.trim() ? resolved : undefined;
}

function RarityFilterTabs(props: {
  value: RarityBucketId;
  counts: Record<RarityBucketId, number> | null;
  countsLoading: boolean;
  onChange: (bucket: RarityBucketId) => void;
}) {
  const { value, counts, countsLoading, onChange } = props;
  return (
    <div
      role="tablist"
      aria-label="Filter cards by rarity"
      className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-panel-raised/35 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {RARITY_TAB_ORDER.map((id) => {
        const active = value === id;
        const n = counts?.[id];
        const countLabel = countsLoading && n === undefined ? "…" : (n ?? "—");
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition touch-manipulation",
              active ? "bg-accent text-canvas shadow-sm" : "text-muted hover:bg-panel-raised hover:text-primary",
            )}
          >
            {RARITY_TAB_LABELS[id]} ({countLabel})
          </button>
        );
      })}
    </div>
  );
}

function FinishFilterTabs(props: {
  value: CatalogFinishBucketId;
  onChange: (finish: CatalogFinishBucketId) => void;
}) {
  const { value, onChange } = props;
  return (
    <div
      role="tablist"
      aria-label="Rare finish filter"
      className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-panel-raised/35 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CATALOG_FINISH_TAB_ORDER.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition touch-manipulation",
              active ? "bg-accent text-canvas shadow-sm" : "text-muted hover:bg-panel-raised hover:text-primary",
            )}
          >
            {CATALOG_FINISH_TAB_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}

function PrintingPresetTabs(props: {
  options: NonNullable<ReturnType<typeof printingPresetTabs>>;
  value: PrintingPresetId;
  onChange: (preset: PrintingPresetId) => void;
}) {
  const { options, value, onChange } = props;
  return (
    <div
      role="tablist"
      aria-label="Print run marketplace bias"
      className="flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-panel-raised/35 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.hint}
            onClick={() => onChange(opt.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition touch-manipulation",
              active ? "bg-accent text-canvas shadow-sm" : "text-muted hover:bg-panel-raised hover:text-primary",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
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
  const [cardsPage, setCardsPage] = useState(1);
  const [rarityBucket, setRarityBucket] = useState<RarityBucketId>("all");
  const [finishBucket, setFinishBucket] = useState<CatalogFinishBucketId>("all");
  const [printingPreset, setPrintingPreset] = useState<PrintingPresetId>("catalog");
  const [rarityCounts, setRarityCounts] = useState<Record<RarityBucketId, number> | null>(null);
  const [rarityCountsLoading, setRarityCountsLoading] = useState(false);
  const [cards, setCards] = useState<TcgCardSummary[]>([]);
  const [cardsMeta, setCardsMeta] = useState({ totalCount: 0, pageSize: CATALOG_PAGE_SIZE, count: 0 });
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

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
    setSetsLoading(true);
    setSetsError(null);
    const q = new URLSearchParams({
      page: String(setsPage),
      pageSize: "40",
      orderBy: setEraToOrderBy(setEra),
      era: setEra,
    });
    if (debouncedQ) q.set("q", debouncedQ);

    void fetchJson<TcgPaginated<TcgSetSummary>>(`/api/pokedex/sets?${q}`)
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
        if (!cancelled) setSetsError(e instanceof Error ? e.message : "Failed to load sets");
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
    setRarityCountsLoading(true);
    setRarityCounts(null);
    void fetchJson<{ counts: Record<RarityBucketId, number> }>(
      `/api/pokedex/cards/rarity-counts?setId=${encodeURIComponent(selectedSetId)}`,
    )
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
    void fetch(`/api/pokedex/variant-artwork-overlay?setId=${encodeURIComponent(selectedSetId)}`)
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
    if (!selectedSetId) {
      setCards([]);
      setCardsMeta({ totalCount: 0, pageSize: CATALOG_PAGE_SIZE, count: 0 });
      return;
    }
    let cancelled = false;
    setCardsLoading(true);
    setCardsError(null);
    const q = new URLSearchParams({
      setId: selectedSetId,
      page: String(cardsPage),
      pageSize: String(CATALOG_PAGE_SIZE),
      rarityBucket,
    });
    if (supportsFinishTabs(selectedSetId) && finishBucket !== "all") {
      q.set("finishBucket", finishBucket);
    }
    if (supportsPrintingPresets(selectedSetId) && printingPreset !== "catalog") {
      q.set("printingPreset", printingPreset);
    }
    void fetchJson<TcgPaginated<TcgCardSummary>>(`/api/pokedex/cards?${q}`)
      .then((payload) => {
        if (cancelled) return;
        setCards(payload.data);
        setCardsMeta({
          totalCount: payload.totalCount,
          pageSize: payload.pageSize,
          count: payload.count,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) setCardsError(e instanceof Error ? e.message : "Failed to load cards");
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSetId, cardsPage, rarityBucket, finishBucket, printingPreset]);

  const onRarityTabChange = useCallback((bucket: RarityBucketId) => {
    setRarityBucket(bucket);
    setFinishBucket("all");
    setCardsPage(1);
    setCards([]);
    setCardsLoading(true);
    setCardsError(null);
  }, []);

  const onFinishTabChange = useCallback((finish: CatalogFinishBucketId) => {
    setFinishBucket(finish);
    setCardsPage(1);
  }, []);

  const onPrintingPresetChange = useCallback((preset: PrintingPresetId) => {
    setPrintingPreset(preset);
    setCardsPage(1);
  }, []);

  const selectSet = useCallback((s: TcgSetSummary) => {
    setSelectedSetId(s.id);
    setSelectedSetName(s.name);
    setSelectedSetSnapshot(s);
    setRarityBucket("all");
    setFinishBucket("all");
    setPrintingPreset("catalog");
    setCardsPage(1);
    setDetail(null);
  }, []);

  const setsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(setsMeta.totalCount / setsMeta.pageSize)),
    [setsMeta.totalCount, setsMeta.pageSize],
  );
  const cardsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(cardsMeta.totalCount / cardsMeta.pageSize)),
    [cardsMeta.totalCount, cardsMeta.pageSize],
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
  /** Embedded: sets full-width until a set is picked; then split (desktop) or cards-only (mobile). */
  const showSetsPane = !embedded || !selectedSetId;
  const showCardsPane = !embedded || Boolean(selectedSetId);
  const embeddedSetOpen = embedded && Boolean(selectedSetId);
  const [setInsightOpen, setSetInsightOpen] = useState(false);

  const inViewRollup = useMemo(() => rollupSetInsightCards(cards), [cards]);
  const inViewPct =
    inViewRollup.cardCount > 0
      ? Math.round((100 * inViewRollup.pricedSlots) / inViewRollup.cardCount)
      : 0;

  const openCardDetailByCatalogId = useCallback(
    (catalogId: string) => {
      const card = cards.find((c) => c.id === catalogId);
      if (card) setDetail(card);
    },
    [cards],
  );

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

    const image =
      detail.images?.large || detail.images?.small || detailResolvedImages?.small ? (
        <CatalogVariantImage
          apiSrc={detail.images?.large ?? detail.images?.small}
          preferredSrc={preferDistinctCurated(
            detail.images?.large ?? detail.images?.small,
            detailResolvedImages?.large ?? detailResolvedImages?.small,
          )}
          alt={detail.name}
          className="h-full w-full object-contain p-0.5"
        />
      ) : null;

    return {
      catalogId: detail.id,
      name: detail.name,
      subtitle,
      image,
      badges,
      extraRows: [
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
        embedded && "liquid-catalog-embed flex min-h-0 flex-1 flex-col text-slate-200",
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
                  "mt-1 flex min-h-0 flex-1 flex-col overflow-hidden",
                  embeddedSetOpen &&
                    "sc-pokedex-catalog-grid--set-open lg:grid lg:max-h-full lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,340px)] lg:grid-rows-1 lg:items-stretch lg:gap-3 [&>*]:min-h-0 [&>*]:max-h-full",
                  !embeddedSetOpen && selectedSetId === null && "lg:grid lg:grid-cols-1",
                )
              : "mt-8 grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-5",
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
              <CatalogEraFilter value={setEra} onChange={setSetEra} embedded={embedded} />
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
                compact={embedded}
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
              "desk-surface-raised flex h-full min-h-0 flex-col overflow-hidden",
              embedded
                ? "min-h-0 flex-1 p-2.5 sc-glass-raised !border-white/8 lg:p-3"
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
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {embedded && mobileStepped ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSetId(null);
                      setSelectedSetName(null);
                      setSelectedSetSnapshot(null);
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
                    <h2 className="text-lg font-semibold text-primary">{selectedSetName}</h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {rarityBucket === "all"
                        ? `${cardsMeta.totalCount} cards`
                        : `${cardsMeta.totalCount} ${RARITY_TAB_LABELS[rarityBucket]} cards`}
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

                <div className="mt-3 shrink-0">
                  <RarityFilterTabs
                    value={rarityBucket}
                    counts={rarityCounts}
                    countsLoading={rarityCountsLoading}
                    onChange={onRarityTabChange}
                  />
                </div>

                {selectedSetId && supportsFinishTabs(selectedSetId) ? (
                  <div className="mt-2 shrink-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Rare finish</p>
                    <FinishFilterTabs value={finishBucket} onChange={onFinishTabChange} />
                  </div>
                ) : null}

                {printingPresetOptionsList ? (
                  <div className="mt-2 shrink-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Print run</p>
                    <PrintingPresetTabs
                      options={printingPresetOptionsList}
                      value={printingPreset}
                      onChange={onPrintingPresetChange}
                    />
                  </div>
                ) : null}

                {embeddedSetOpen ? (
                  <div className="mt-2 shrink-0 lg:hidden">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">
                            Set insight
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted">
                            {fmtUsd(inViewRollup.tcgPlayerSumUsd)} · {inViewRollup.pricedSlots} priced · {inViewPct}%
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSetInsightOpen(true)}
                          className="shrink-0"
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {!embedded && selectedSetId && selectedSetName && hasCatalogSetOverlay(selectedSetId) ? (
                  <div className="mt-3 shrink-0">
                    <PokedexSetOverviewPanel setId={selectedSetId} setName={selectedSetName} />
                  </div>
                ) : null}

                <div className="sc-catalog-cards-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pt-2 scanner-chat-scrollbar touch-pan-y lg:pt-3">
                  {cardsLoading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      Loading cards…
                    </div>
                  ) : cardsError ? (
                    <p className="text-sm text-danger">{cardsError}</p>
                  ) : cards.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted">
                      {rarityBucket === "all"
                        ? "No cards were returned for this set."
                        : `No cards match the "${RARITY_TAB_LABELS[rarityBucket]}" filter here. Try another tab or All — some rarities only appear under All.`}
                    </p>
                  ) : (
                    <CatalogFocusGrid
                      items={cards}
                      getKey={(c) => `${c.id}-${c.catalogFinish ?? "std"}`}
                      className={cn(
                        embedded
                          ? "grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3"
                          : undefined,
                      )}
                      renderItem={(c) => {
                        const apiSmall = c.images?.small;
                        const resolved = resolveCatalogCardImages({
                          setId: selectedSetId,
                          card: c,
                          printingPreset,
                          overlay: variantArtworkOverlay,
                        });
                        const preferred = preferDistinctCurated(apiSmall, resolved.small);
                        return (
                          <button
                            type="button"
                            onClick={() => setDetail(c)}
                            className="group h-full w-full overflow-hidden rounded-xl border border-border-subtle bg-panel-raised/50 text-left transition hover:border-accent/40 touch-manipulation"
                          >
                            <div
                              className={cn(
                                "relative w-full bg-subtle",
                                embedded ? "aspect-[3/4]" : "aspect-[245/342]",
                              )}
                            >
                              {apiSmall || preferred ? (
                                <CatalogVariantImage
                                  apiSrc={apiSmall}
                                  preferredSrc={preferred}
                                  alt=""
                                  className="h-full w-full object-contain transition group-hover:scale-[1.02]"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-[10px] text-faint">
                                  No art
                                </div>
                              )}
                              <div className="pointer-events-none absolute inset-x-1 bottom-1 flex items-end justify-between gap-1">
                                {c.catalogFinish === "reverse_holo" ? (
                                  <span className="rounded bg-violet-950/80 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white">
                                    Reverse
                                  </span>
                                ) : null}
                                {printingMarketSuffix ? (
                                  <span
                                    className={cn(
                                      "rounded bg-black/55 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white",
                                      c.catalogFinish !== "reverse_holo" ? "ml-auto" : "",
                                    )}
                                  >
                                    {printingMarketSuffix}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className={cn("p-2", embedded && "p-2.5")}>
                              <p
                                className={cn(
                                  "line-clamp-2 font-medium leading-snug text-primary",
                                  embedded ? "text-xs" : "text-[11px]",
                                )}
                              >
                                {c.name}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted">
                                #{c.number}
                                {c.rarity ? ` · ${c.rarity}` : ""}
                                {c.catalogFinish === "reverse_holo" ? " · Rev holo" : ""}
                              </p>
                            </div>
                          </button>
                        );
                      }}
                    />
                  )}
                </div>

                {selectedSetId && !cardsLoading && cardsMeta.totalCount > cardsMeta.pageSize ? (
                  <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs text-muted">
                    <span>
                      Page {cardsPage} / {cardsTotalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={cardsPage <= 1}
                        onClick={() => setCardsPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={cardsPage >= cardsTotalPages}
                        onClick={() => setCardsPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Card>
          ) : null}

          {embeddedSetOpen && selectedSetId ? (
            <CatalogSetInsightRail
              setId={selectedSetId}
              setName={selectedSetName ?? "Set"}
              cards={cards}
              onSelectCard={openCardDetailByCatalogId}
              className="hidden min-h-0 rounded-xl lg:flex"
            />
          ) : null}
        </div>
      </div>

      {detail ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
            aria-label="Close card detail"
            onClick={() => setDetail(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pokedex-card-title"
            className="sc-pokedex-card-detail-sheet desk-surface-raised fixed inset-x-0 bottom-0 z-[70] flex max-h-[min(92dvh,860px)] flex-col overflow-hidden rounded-t-[1.35rem] border border-border-subtle/80 shadow-panel sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-[calc(100dvh-1.5rem)] sm:w-[min(30rem,calc(100vw-1.5rem))] sm:rounded-2xl lg:right-4 lg:w-[min(28rem,calc(100vw-2rem))]"
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-subtle/80 sm:hidden" aria-hidden />

            <header className="relative shrink-0 border-b border-border-subtle/70 px-3 py-2 sm:px-4">
              <button
                type="button"
                className="absolute right-2 top-1.5 flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-panel-raised/80 hover:text-primary touch-manipulation sm:right-3"
                onClick={() => setDetail(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
              <h3
                id="pokedex-card-title"
                className="pr-10 text-sm font-semibold leading-snug text-primary line-clamp-2"
              >
                {detail.name}
              </h3>
              {catalogDetailIdentity?.subtitle ? (
                <p className="mt-0.5 pr-10 text-[11px] leading-snug text-muted line-clamp-1">
                  {catalogDetailIdentity.subtitle}
                </p>
              ) : null}
            </header>

            <div className="sc-pokedex-card-detail-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2 scanner-chat-scrollbar sm:px-4">
              {catalogDetailIdentity ? (
                <CatalogCardDetailBody
                  identity={catalogDetailIdentity}
                  variant="sheet"
                  hideTitle
                />
              ) : null}
            </div>

            <footer className="sc-pokedex-card-detail-footer shrink-0 border-t border-border-subtle/70 bg-panel/80 px-3 py-2.5 backdrop-blur-sm sm:px-4">
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
            </footer>
          </div>
        </>
      ) : null}

      {embeddedSetOpen && mobileStepped && selectedSetId ? (
        <CatalogCardDetailSheet
          open={setInsightOpen}
          onClose={() => setSetInsightOpen(false)}
          title="Set insight"
          subtitle={selectedSetName ?? selectedSetId}
          backLabel="Back to cards"
          onBack={() => setSetInsightOpen(false)}
        >
          <CatalogSetInsightRail
            setId={selectedSetId}
            setName={selectedSetName ?? "Set"}
            cards={cards}
            onSelectCard={(catalogId) => {
              setSetInsightOpen(false);
              openCardDetailByCatalogId(catalogId);
            }}
            className="border-0 bg-transparent shadow-none"
          />
        </CatalogCardDetailSheet>
      ) : null}
    </div>
  );
}
