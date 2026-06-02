"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { tcgSummaryHasFmv } from "@/lib/pokedex/tcg-price-hydrate";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";

function cardNeedsFmv(card: TcgCardSummary): boolean {
  if (card.rawFmvUsd != null) return false;
  return !tcgSummaryHasFmv(card);
}

function mergeCard(base: TcgCardSummary, patch?: Partial<TcgCardSummary>): TcgCardSummary {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    catalogPrices: patch.catalogPrices ?? base.catalogPrices,
    tcgplayer: patch.tcgplayer ?? base.tcgplayer,
    cardmarket: patch.cardmarket ?? base.cardmarket,
    images: patch.images ?? base.images,
    set: patch.set ?? base.set,
  };
}

/**
 * Backfills Raw FMV on grid cards when the list API returned URL-only prices_json
 * or a stale client cache. Batches live TCGPlayer hydration via POST /api/pokedex/cards/prices.
 */
export function useHydrateCatalogFmv(
  cards: TcgCardSummary[],
  setId: string | null,
  enabled = true,
): TcgCardSummary[] {
  const [patches, setPatches] = useState<Record<string, Partial<TcgCardSummary>>>({});
  const patchesRef = useRef(patches);
  patchesRef.current = patches;
  const hydratedKeysRef = useRef(new Set<string>());
  const inflightRef = useRef(false);

  const cardsKey = useMemo(
    () => cards.map((c) => c.id).join(","),
    [cards],
  );

  useEffect(() => {
    if (!enabled || !setId || !cards.length) return;

    const missing = cards.filter((c) => {
      const merged = mergeCard(c, patchesRef.current[c.id]);
      if (!cardNeedsFmv(merged)) return false;
      const key = `${setId}:${c.id}`;
      return !hydratedKeysRef.current.has(key);
    });

    if (!missing.length || inflightRef.current) return;

    const timer = window.setTimeout(() => {
      inflightRef.current = true;
      const batch = missing.slice(0, 80);
      for (const c of batch) {
        hydratedKeysRef.current.add(`${setId}:${c.id}`);
      }

      void fetch("/api/pokedex/cards/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setId, cards: batch }),
      })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as { cards?: TcgCardSummary[] };
        })
        .then((body) => {
          if (!body?.cards?.length) return;
          setPatches((prev) => {
            const next = { ...prev };
            for (const row of body.cards!) {
              next[row.id] = { ...prev[row.id], ...row };
            }
            return next;
          });
        })
        .catch(() => {})
        .finally(() => {
          inflightRef.current = false;
        });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [cardsKey, setId, enabled, cards]);

  return useMemo(
    () => cards.map((c) => mergeCard(c, patches[c.id])),
    [cards, patches],
  );
}
