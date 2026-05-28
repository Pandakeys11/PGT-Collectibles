import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { loadSetMarketEvidenceMap } from "@/lib/catalog/set-insight-comps";
import { catalogCardReferenceEvidence } from "@/lib/market/catalog-reference-evidence";
import {
  resolveCatalogRawFmvForCard,
  type CatalogRawFmv,
} from "@/lib/market/catalog-raw-fmv";
import type { TcgCardSummary } from "@/lib/pokedex/tcg-api-types";
import type { MarketEvidence } from "@/lib/scan/schemas";

function tcgCardToCatalogSummary(card: TcgCardSummary): CatalogCardSummary {
  return {
    id: card.id,
    name: card.name,
    number: card.number ?? null,
    rarity: card.rarity ?? null,
    supertype: null,
    catalogFinish: card.catalogFinish,
    catalogVariantKey: card.catalogVariantKey,
    catalogVariantLabel: card.catalogVariantLabel,
    sourceCatalogId: card.sourceCatalogId,
    images: card.images,
    set: card.set
      ? {
          id: card.set.id,
          name: card.set.name,
          releaseDate: card.set.releaseDate ?? null,
        }
      : undefined,
    franchise: "pokemon",
    prices: card.catalogPrices,
  };
}

function marketEvidenceForTcgCard(
  card: TcgCardSummary,
  persisted: MarketEvidence[] | undefined,
): MarketEvidence[] {
  const catalogRef = catalogCardReferenceEvidence(tcgCardToCatalogSummary(card));
  const seen = new Set<string>();
  const out: MarketEvidence[] = [];
  for (const row of [...(persisted ?? []), ...catalogRef]) {
    const key = `${row.kind}|${row.url ?? ""}|${row.title}|${row.priceUsd ?? ""}|${row.observedAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export function resolveRawFmvForTcgCard(
  card: TcgCardSummary,
  persisted?: MarketEvidence[],
): CatalogRawFmv {
  return resolveCatalogRawFmvForCard({
    catalogPrices: card.catalogPrices,
    tcgplayer: card.tcgplayer,
    cardmarket: card.cardmarket,
    catalogFinish: card.catalogFinish,
    rarity: card.rarity,
    identity: {
      name: card.name,
      number: card.number,
      set: card.set?.name ?? null,
    },
    marketEvidence: marketEvidenceForTcgCard(card, persisted),
  });
}

/** Attach headline Raw FMV to grid cards (same stack as catalog detail intel). */
export async function attachRawFmvToTcgCards(
  cards: TcgCardSummary[],
): Promise<TcgCardSummary[]> {
  if (!cards.length) return cards;

  const evidenceMap = await loadSetMarketEvidenceMap(cards.map((c) => c.id));

  return cards.map((card) => {
    const fmv = resolveRawFmvForTcgCard(card, evidenceMap.get(card.id));
    return {
      ...card,
      rawFmvUsd: fmv.usd,
      rawFmvSourceLabel: fmv.sourceLabel,
      rawFmvBasis: fmv.basis,
      tcgPlayerUsd: fmv.tcgPlayerUsd,
      priceChartingUsd: fmv.priceChartingUsd,
    };
  });
}
