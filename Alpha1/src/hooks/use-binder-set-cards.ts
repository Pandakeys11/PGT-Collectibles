"use client";

import { useEffect, useMemo, useState } from "react";
import { sortCatalogCards, type CatalogCardSortId } from "@/lib/catalog/catalog-card-sort";
import { fetchCatalogJson, readCatalogCache } from "@/lib/catalog/catalog-fetch-cache";
import { useHydrateCatalogFmv } from "@/hooks/use-hydrate-catalog-fmv";
import { tcgSummaryHasFmv } from "@/lib/pokedex/tcg-price-hydrate";
import type { TcgCardSummary, TcgPaginated } from "@/lib/pokedex/tcg-api-types";
import type { RarityBucketId } from "@/lib/pokedex/rarity-buckets";
import {
  supportsFinishTabs,
  supportsPrintingPresets,
  type CatalogFinishBucketId,
  type PrintingPresetId,
} from "@/lib/pokedex/set-catalog-config";

const BINDER_FETCH_PAGE_SIZE = 100;

function buildBinderCardsUrl(
  setId: string,
  page: number,
  rarityBucket: RarityBucketId,
  finishBucket: CatalogFinishBucketId,
  printingPreset: PrintingPresetId,
): string {
  const q = new URLSearchParams({
    setId,
    page: String(page),
    pageSize: String(BINDER_FETCH_PAGE_SIZE),
    rarityBucket,
  });
  if (supportsFinishTabs(setId) && finishBucket !== "all") {
    q.set("finishBucket", finishBucket);
  }
  if (supportsPrintingPresets(setId) && printingPreset !== "catalog") {
    q.set("printingPreset", printingPreset);
  }
  return `/api/pokedex/cards?${q}`;
}

/**
 * Loads every card in a set (paged API) for binder spread navigation.
 */
export function useBinderSetCards({
  setId,
  rarityBucket,
  finishBucket,
  printingPreset,
  cardSort,
  enabled = true,
}: {
  setId: string | null;
  rarityBucket: RarityBucketId;
  finishBucket: CatalogFinishBucketId;
  printingPreset: PrintingPresetId;
  cardSort: CatalogCardSortId;
  enabled?: boolean;
}) {
  const [cards, setCards] = useState<TcgCardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!setId || !enabled) {
      setCards([]);
      setTotalCount(0);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCards([]);

    void (async () => {
      try {
        const all: TcgCardSummary[] = [];
        let page = 1;
        let expectedTotal = 0;
        let servedFromCache = false;

        for (;;) {
          const url = buildBinderCardsUrl(setId, page, rarityBucket, finishBucket, printingPreset);
          const cached = readCatalogCache<TcgPaginated<TcgCardSummary>>(url);
          if (cached) servedFromCache = true;
          const payload =
            cached ?? (await fetchCatalogJson<TcgPaginated<TcgCardSummary>>(url));

          if (cancelled) return;

          expectedTotal = payload.totalCount;
          all.push(...payload.data);

          if (all.length >= expectedTotal || payload.data.length < BINDER_FETCH_PAGE_SIZE) {
            break;
          }
          page += 1;
        }

        if (!cancelled) {
          const needsFmv = all.some(
            (c) => c.rawFmvUsd == null && !tcgSummaryHasFmv(c),
          );
          if (needsFmv && servedFromCache) {
            try {
              const freshPages: TcgCardSummary[] = [];
              let p = 1;
              for (;;) {
                const freshUrl = buildBinderCardsUrl(
                  setId,
                  p,
                  rarityBucket,
                  finishBucket,
                  printingPreset,
                );
                const payload = await fetchCatalogJson<TcgPaginated<TcgCardSummary>>(
                  freshUrl,
                  { cache: "no-store" },
                );
                freshPages.push(...payload.data);
                if (
                  freshPages.length >= payload.totalCount ||
                  payload.data.length < BINDER_FETCH_PAGE_SIZE
                ) {
                  break;
                }
                p += 1;
              }
              if (!cancelled && freshPages.length) {
                all.splice(0, all.length, ...freshPages);
              }
            } catch {
              /* keep cached rows; client FMV hook will backfill */
            }
          }
          setCards(all);
          setTotalCount(expectedTotal || all.length);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load binder cards");
          setCards([]);
          setTotalCount(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setId, rarityBucket, finishBucket, printingPreset, enabled]);

  const sorted = useMemo(
    () => sortCatalogCards(cards, cardSort),
    [cards, cardSort],
  );

  const withFmv = useHydrateCatalogFmv(sorted, setId, enabled && !loading);

  return { cards: withFmv, loading, error, totalCount };
}
