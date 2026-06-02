"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sortCatalogCards, type CatalogCardSortId } from "@/lib/catalog/catalog-card-sort";
import { fetchCatalogJson, readCatalogCache } from "@/lib/catalog/catalog-fetch-cache";
import { useHydrateCatalogFmv } from "@/hooks/use-hydrate-catalog-fmv";
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
  const prevSetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!setId || !enabled) {
      setCards([]);
      setTotalCount(0);
      setError(null);
      setLoading(false);
      prevSetIdRef.current = null;
      return;
    }

    if (prevSetIdRef.current !== setId) {
      setCards([]);
      prevSetIdRef.current = setId;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const all: TcgCardSummary[] = [];
        let page = 1;
        let expectedTotal = 0;

        for (;;) {
          const url = buildBinderCardsUrl(setId, page, rarityBucket, finishBucket, printingPreset);
          const cached = readCatalogCache<TcgPaginated<TcgCardSummary>>(url);
          const payload =
            cached ?? (await fetchCatalogJson<TcgPaginated<TcgCardSummary>>(url));

          if (cancelled) return;

          expectedTotal = payload.totalCount;
          all.push(...payload.data);

          if (!cancelled && all.length > 0) {
            setCards([...all]);
            setTotalCount(expectedTotal || all.length);
            setLoading(false);
          }

          if (all.length >= expectedTotal || payload.data.length < BINDER_FETCH_PAGE_SIZE) {
            break;
          }
          page += 1;
        }

        if (!cancelled) {
          setCards([...all]);
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

  const withFmv = useHydrateCatalogFmv(sorted, setId, enabled);

  return { cards: withFmv, loading, error, totalCount };
}
