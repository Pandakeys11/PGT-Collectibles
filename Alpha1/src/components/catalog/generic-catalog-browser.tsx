"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { CatalogCardDetailSheet } from "@/components/catalog/catalog-card-detail-sheet";
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

function setInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

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
    const liveFranchises = new Set(["magic", "yugioh", "onepiece", "lorcana"]);
    if (liveFranchises.has(franchise)) {
      const cache =
        meta.cardCountEstimate && meta.cardCountEstimate > 0
          ? `${meta.cardCountEstimate.toLocaleString()} cached · `
          : "";
      return `${cache}Live ${meta.sourceLabel} · nightly sync keeps DB fresh`;
    }
    if (meta.cardCountEstimate && meta.cardCountEstimate > 0) {
      return `${meta.cardCountEstimate.toLocaleString()} cards cached · ${meta.sourceLabel}`;
    }
    return `Run npm run catalog:sync:all to populate ${meta.label}`;
  }, [meta, franchise]);

  const selectSet = useCallback((set: CatalogSetSummary) => {
    setSelectedSet(set);
    setDetail(null);
    setCardQuery("");
  }, []);

  const inputClass = embedded
    ? "h-8 rounded-md border-white/10 bg-white/[0.04] pl-8 text-[11px] text-slate-100 placeholder:text-slate-600 sm:h-8 sm:text-[11px]"
    : "h-10 pl-9";

  return (
    <div className={cn("w-full min-w-0 max-w-full", embedded ? "space-y-3" : "space-y-3")}>
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

      {!selectedSet ? (
        <div className="space-y-2">
          {setsLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading sets…
            </p>
          ) : setsError ? (
            <p className="text-xs text-danger">{setsError}</p>
          ) : sets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-muted">
              No sets yet. Run <code className="text-accent">npm run catalog:sync:all</code> or wait
              for the nightly catalog sync.
            </p>
          ) : (
            <ul
              className={cn(
                "space-y-1.5 overflow-y-auto pr-0.5 scanner-chat-scrollbar",
                embedded
                  ? mobileStepped
                    ? "min-h-[min(48dvh,420px)] max-h-[min(56dvh,480px)]"
                    : "max-h-[min(38dvh,300px)]"
                  : "max-h-[min(42vh,360px)]",
              )}
            >
              {sets.map((set) => (
                <li key={set.id}>
                  <button
                    type="button"
                    onClick={() => selectSet(set)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.03] text-left transition touch-manipulation hover:border-amber-200/25 hover:bg-amber-300/[0.05]",
                      embedded ? "px-2 py-2" : "gap-3 px-3 py-2.5",
                    )}
                  >
                    <div
                      className={cn(
                        "flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/30 font-semibold text-slate-500",
                        embedded ? "h-8 w-8 text-[9px]" : "h-10 w-10 rounded-lg text-[10px]",
                      )}
                    >
                      {set.images?.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={set.images.logo} alt="" className="max-h-full max-w-full object-contain p-1" />
                      ) : (
                        setInitials(set.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate font-medium text-slate-100",
                          embedded ? "text-[11px]" : "text-primary",
                        )}
                      >
                        {set.name}
                      </p>
                      <p
                        className={cn(
                          "truncate text-slate-500",
                          embedded ? "text-[9px]" : "text-[10px] text-muted",
                        )}
                      >
                        {[set.code, set.year, set.total != null ? `${set.total} cards` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {setsMeta.totalCount > sets.length ? (
            <div className="flex justify-center gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={setsPage <= 1}
                onClick={() => setSetsPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={setsPage * setsMeta.pageSize >= setsMeta.totalCount}
                onClick={() => setSetsPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={cn("space-y-3", embedded && mobileStepped && "min-h-[min(52dvh,480px)]")}>
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
                      "w-full overflow-hidden rounded-xl border bg-[#070b10] text-left transition",
                      detail?.id === card.id
                        ? "border-emerald-300/35 ring-1 ring-emerald-300/20"
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
              {cardsMeta.totalCount > cards.length ? (
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
            <ScanThisCardButton
              prefill={cardToPrefill(detail, franchise)}
              targetPath={scanTargetPath}
              onScan={onScanPrefill}
              compact={false}
              className="w-full sm:w-auto"
            />
          ) : undefined
        }
      >
        {detail ? (
          <>
            {detail.images?.large || detail.images?.small ? (
              <div className="mx-auto w-full max-w-[min(78vw,15rem)]">
                <div className="aspect-[2.5/3.5] overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.65)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detail.images.large ?? detail.images.small}
                    alt={detail.name}
                    className="h-full w-full object-contain p-3"
                  />
                </div>
              </div>
            ) : null}
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-white/8 pb-3">
                <dt className="text-muted">Set</dt>
                <dd className="text-right font-medium text-slate-100">
                  {detail.set?.name ?? selectedSet?.name}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-white/8 pb-3">
                <dt className="text-muted">Number</dt>
                <dd className="text-right font-medium text-slate-100">{detail.number ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Rarity</dt>
                <dd className="text-right font-medium text-slate-100">{detail.rarity ?? "—"}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </CatalogCardDetailSheet>
    </div>
  );
}
