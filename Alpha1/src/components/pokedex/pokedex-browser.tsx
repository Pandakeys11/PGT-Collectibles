"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BookOpen, ChevronRight, Loader2, Search, X } from "lucide-react";
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
import { CatalogFocusGrid } from "@/components/pokedex/catalog-focus-grid";
import { CatalogVariantImage } from "@/components/pokedex/catalog-variant-image";
import { PokedexCardMarketPanel } from "@/components/pokedex/pokedex-card-market-panel";
import { ScanThisCardButton } from "@/components/pokedex/scan-this-card-button";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
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

function preferDistinctCurated(api: string | undefined, resolved: string | undefined): string | undefined {
  if (!resolved?.trim()) return undefined;
  if (!api?.trim()) return resolved;
  return resolved.trim() !== api.trim() ? resolved : undefined;
}

function setListInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const w = name.trim();
  return w.slice(0, 2).toUpperCase() || "?";
}

function SetListLogo({ tcgSet, embedded = false }: { tcgSet: TcgSetSummary; embedded?: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = tcgSet.images?.logo || tcgSet.images?.symbol;
  const frame = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-subtle bg-panel-raised/80",
    embedded ? "h-10 w-10 lg:h-12 lg:w-12" : "h-11 w-11 sm:h-12 sm:w-12",
  );
  if (!src || failed) {
    return (
      <div className={cn(frame, "text-[10px] font-semibold uppercase tracking-tight text-faint")} aria-hidden>
        {setListInitials(tcgSet.name)}
      </div>
    );
  }
  return (
    <div className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-full max-w-full object-contain object-center p-1"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
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

function CatalogMetaRow({
  label,
  children,
  emphasize,
}: {
  label: string;
  children: ReactNode;
  emphasize?: boolean;
}) {
  if (children == null || children === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 pt-0.5 text-desk-label">{label}</dt>
      <dd
        className={cn(
          "min-w-0 flex-1 text-right leading-snug text-primary break-words",
          emphasize ? "font-display text-base font-semibold" : "text-sm font-medium",
        )}
      >
        {children}
      </dd>
    </div>
  );
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

  const catalogDetailFields = useMemo(() => {
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

    return {
      setName,
      series,
      releaseYear,
      releaseDate,
      cardsInSet,
    };
  }, [detail, selectedSetName, selectedSetSnapshot]);

  return (
    <div
      className={cn(
        "relative min-w-0 max-w-full overflow-x-hidden",
        embedded && "liquid-catalog-embed text-slate-200",
      )}
    >
      <div className={cn("mx-auto max-w-full", !embedded && "max-w-[1600px]")}>
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
              ? "mt-1 flex flex-col lg:grid lg:grid-cols-[minmax(280px,34%)_minmax(0,1fr)] lg:gap-4 xl:grid-cols-[minmax(320px,36%)_minmax(0,1fr)]"
              : "mt-8 grid lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-5",
          )}
        >
          <Card
            className={cn(
              "desk-surface-raised flex min-h-0 flex-col overflow-hidden",
              embedded
                ? "max-h-[min(40dvh,320px)] shrink-0 p-2.5 sc-glass-raised !border-white/8 max-lg:shrink-0 lg:max-h-none lg:min-h-0 lg:p-4"
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
                      onClick={() => setSetEra(era)}
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

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-border-subtle bg-panel-raised/30">
              {setsLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Loading sets…
                </div>
              ) : setsError ? (
                <p className="p-4 text-sm text-danger">{setsError}</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {sets.map((s) => {
                    const promo = getCatalogPromoSpecialRow(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => selectSet(s)}
                          className={cn(
                            "flex w-full items-center gap-2.5 text-left transition touch-manipulation",
                            embedded ? "px-2.5 py-2 lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm" : "gap-3 px-3 py-2.5 text-sm",
                            selectedSetId === s.id ? "bg-accent/15 text-primary" : "hover:bg-panel-raised",
                          )}
                        >
                          <SetListLogo tcgSet={s} embedded={embedded} />
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "flex flex-wrap items-center gap-1.5 font-medium leading-snug",
                                embedded && "text-[11px] lg:text-sm",
                              )}
                            >
                              <span className="line-clamp-2 lg:line-clamp-none">{s.name}</span>
                              {promo ? (
                                <span
                                  className={cn(
                                    "shrink-0 rounded bg-panel-raised px-1.5 py-0.5 font-semibold uppercase tracking-wide text-muted",
                                    embedded ? "text-[8px] lg:text-[9px]" : "text-[9px]",
                                  )}
                                >
                                  {promo.bucket === "promo" ? "Promo" : "Special"}
                                </span>
                              ) : null}
                            </p>
                            <p
                              className={cn(
                                "mt-0.5 text-muted",
                                embedded ? "text-[10px] leading-snug lg:text-xs" : "text-xs",
                              )}
                            >
                              <span className="line-clamp-2 lg:line-clamp-1">
                                {s.series} · {s.releaseDate} · {s.printedTotal ?? s.total} cards
                              </span>
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div
              className={cn(
                "mt-3 flex shrink-0 items-center justify-between gap-2 text-muted",
                embedded ? "text-[10px] lg:text-xs" : "text-xs",
              )}
            >
              <span className="min-w-0 truncate">
                Page {setsPage} / {setsTotalPages} · {setsMeta.totalCount} sets
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={setsPage <= 1 || setsLoading}
                  onClick={() => setSetsPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={setsPage >= setsTotalPages || setsLoading}
                  onClick={() => setSetsPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>

          <Card
            className={cn(
              "desk-surface-raised flex min-h-0 flex-col overflow-hidden",
              embedded
                ? "min-h-[min(42dvh,380px)] flex-1 p-2.5 sc-glass-raised !border-white/8 lg:min-h-0 lg:p-4"
                : "min-h-[50dvh] p-4 sm:p-5 lg:min-h-[calc(100dvh-10rem)]",
            )}
          >
            {!selectedSetId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center text-sm text-muted">
                <p className="max-w-sm text-pretty">Choose a set on the left to load its cards here.</p>
              </div>
            ) : (
              <>
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

                {selectedSetId && selectedSetName && hasCatalogSetOverlay(selectedSetId) ? (
                  <div className="mt-3 shrink-0">
                    <PokedexSetOverviewPanel setId={selectedSetId} setName={selectedSetName} />
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto pt-3">
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
                            <div className="relative aspect-[245/342] w-full bg-subtle">
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
                            <div className="p-2">
                              <p className="line-clamp-2 text-[11px] font-medium leading-snug text-primary">{c.name}</p>
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
              </>
            )}
          </Card>
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
            className="desk-surface-raised fixed inset-x-0 bottom-0 z-[70] max-h-[min(92dvh,860px)] overflow-y-auto rounded-t-[1.35rem] border border-border-subtle/80 px-4 pb-6 pt-3 shadow-panel sm:inset-y-4 sm:left-auto sm:right-4 sm:flex sm:max-h-none sm:w-[min(100vw-2rem,420px)] sm:flex-col sm:rounded-2xl sm:px-5 sm:pb-6 sm:pt-4"
          >
            <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border-subtle/80 sm:hidden" aria-hidden />

            <header className="relative flex flex-col items-center px-1 pb-2 pt-2 text-center">
              <button
                type="button"
                className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-panel-raised/80 hover:text-primary touch-manipulation"
                onClick={() => setDetail(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>

              {detail.images?.large || detail.images?.small || detailResolvedImages?.small ? (
                <div className="mx-auto w-full max-w-[min(72vw,13.5rem)]">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-panel-raised/50 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.65)] ring-1 ring-border-subtle/90">
                    <CatalogVariantImage
                      apiSrc={detail.images?.large ?? detail.images?.small}
                      preferredSrc={preferDistinctCurated(
                        detail.images?.large ?? detail.images?.small,
                        detailResolvedImages?.large ?? detailResolvedImages?.small,
                      )}
                      alt={detail.name}
                      className="h-full w-full object-contain p-2.5"
                    />
                  </div>
                </div>
              ) : null}

              <h3 id="pokedex-card-title" className="sr-only">
                {detail.name}
              </h3>

              {(detail.catalogFinish === "reverse_holo" ||
                (printingPreset !== "catalog" && printingMarketSuffix)) && (
                <div className="mt-3 flex max-w-full flex-wrap justify-center gap-1.5">
                  {detail.catalogFinish === "reverse_holo" ? (
                    <span className="inline-flex rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-medium text-violet-300">
                      Reverse holofoil
                    </span>
                  ) : null}
                  {printingPreset !== "catalog" && printingMarketSuffix ? (
                    <span className="inline-flex rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent">
                      Comps: {printingMarketSuffix}
                    </span>
                  ) : null}
                </div>
              )}
            </header>

            <dl className="mt-2 divide-y divide-border-subtle/70 border-t border-border-subtle/70">
              <CatalogMetaRow label="Name" emphasize>
                {detail.name}
              </CatalogMetaRow>
              {catalogDetailFields ? (
                <>
                  <CatalogMetaRow label="Set">{catalogDetailFields.setName}</CatalogMetaRow>
                  <CatalogMetaRow label="Series">{catalogDetailFields.series}</CatalogMetaRow>
                  <CatalogMetaRow label="Year">{catalogDetailFields.releaseYear}</CatalogMetaRow>
                  <CatalogMetaRow label="Released">{catalogDetailFields.releaseDate}</CatalogMetaRow>
                  <CatalogMetaRow label="Cards in set">{catalogDetailFields.cardsInSet}</CatalogMetaRow>
                </>
              ) : null}
              <CatalogMetaRow label="Card #">{detail.number ? `#${detail.number}` : null}</CatalogMetaRow>
              <CatalogMetaRow label="Rarity">
                {detail.rarity}
                {detail.catalogFinish === "reverse_holo" ? " · Reverse holofoil" : null}
              </CatalogMetaRow>
              <CatalogMetaRow label="HP">{detail.hp ? `${detail.hp} HP` : null}</CatalogMetaRow>
              <CatalogMetaRow label="Type">{detail.supertype}</CatalogMetaRow>
              <CatalogMetaRow label="Subtypes">
                {detail.subtypes?.length ? detail.subtypes.join(", ") : null}
              </CatalogMetaRow>
              <CatalogMetaRow label="Artist">{detail.artist}</CatalogMetaRow>
            </dl>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {catalogScanPrefill ? (
                <ScanThisCardButton
                  prefill={catalogScanPrefill}
                  className="w-full sm:w-auto"
                  targetPath={scanTargetPath}
                  onScan={onScanPrefill}
                />
              ) : null}
              {detail.tcgplayer?.url ? (
                <Button size="sm" variant="secondary" asChild>
                  <a href={detail.tcgplayer.url} target="_blank" rel="noreferrer">
                    TCGPlayer
                  </a>
                </Button>
              ) : null}
              {detail.cardmarket?.url ? (
                <Button size="sm" variant="secondary" asChild>
                  <a href={detail.cardmarket.url} target="_blank" rel="noreferrer">
                    Cardmarket
                  </a>
                </Button>
              ) : null}
            </div>
            <PokedexCardMarketPanel cardId={detail.sourceCatalogId ?? detail.id} printingHint={detailMarketPrintingHint} />
          </div>
        </>
      ) : null}
    </div>
  );
}
