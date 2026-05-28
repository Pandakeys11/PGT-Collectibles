import { catalogMomentumPct } from "@/lib/catalog/set-insight-utils";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { getPokeTraceRealtimeUpdate } from "@/lib/market/poketrace/realtime-store";

/** PokeTrace WS overlay → cached pokeTrace meta → Cardmarket fallback. */
export function resolvedCatalogMomentumPct(
  pricesJson: Record<string, unknown> | null | undefined,
): number | null {
  const prices = parseCatalogPriceSnapshot(pricesJson);
  const pokeId = prices.pokeTrace?.cardId;
  if (pokeId) {
    const live = getPokeTraceRealtimeUpdate(pokeId);
    if (live?.trendPct != null) return live.trendPct;
  }
  return catalogMomentumPct(prices);
}
