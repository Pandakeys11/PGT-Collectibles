"use client";

import { useEffect, useState } from "react";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import {
  fetchCatalogMarketIntel,
  readCachedCatalogIntel,
} from "@/lib/market/catalog-intel-client";

/** Lite catalog intel — reference prices (PriceCharting PSA tiers) for scan market panels. */
export function useCatalogIntelLite(
  catalogId: string | null | undefined,
  options?: { enabled?: boolean },
): {
  referencePrices: CatalogPriceSnapshot | null;
  loading: boolean;
} {
  const enabled = options?.enabled !== false;
  const id = catalogId?.trim() ?? "";

  const [referencePrices, setReferencePrices] = useState<CatalogPriceSnapshot | null>(() => {
    if (!id || !enabled) return null;
    return readCachedCatalogIntel(id, true)?.referencePrices ?? null;
  });
  const [loading, setLoading] = useState(() => Boolean(id && enabled && !referencePrices));

  useEffect(() => {
    if (!id || !enabled) {
      setReferencePrices(null);
      setLoading(false);
      return;
    }

    const cached = readCachedCatalogIntel(id, true);
    if (cached?.referencePrices) {
      setReferencePrices(cached.referencePrices);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchCatalogMarketIntel(id, { lite: true })
      .then((knowledge) => {
        if (cancelled) return;
        setReferencePrices(knowledge.referencePrices ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setReferencePrices(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, enabled]);

  return { referencePrices, loading };
}
