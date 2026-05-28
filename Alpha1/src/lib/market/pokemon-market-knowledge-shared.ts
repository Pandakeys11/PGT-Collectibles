import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import type { FairValueBasis } from "@/lib/market/fair-value";
import type { MarketIntelligence } from "@/lib/market/market-intelligence";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import { extractedCardSchema } from "@/lib/scan/schemas";

export type PokemonMarketKnowledge = {
  catalogId: string;
  card: {
    name: string;
    setName: string | null;
    setCode: string | null;
    number: string | null;
    year: string | null;
    rarity: string | null;
    imageSmallUrl: string | null;
    imageLargeUrl: string | null;
  } | null;
  referencePrices: CatalogPriceSnapshot;
  intel: CatalogMarketIntel | null;
  marketEvidence: MarketEvidence[];
  intelligence: MarketIntelligence;
  fairValueUsd: number | null;
  fairValueBasis: FairValueBasis | null;
  /** Ungraded headline — TCGPlayer first, then PriceCharting, then sold comps. */
  rawFmvUsd: number | null;
  rawFmvBasis: FairValueBasis | null;
  tcgPlayerUsd: number | null;
  priceChartingUsd: number | null;
  rawFmvSourceLabel: string;
  institutionalMemory: boolean;
  dataDepth: {
    persistedComps: number;
    catalogReferenceRows: number;
    populationSnapshots: number;
    certifications: number;
  };
  refreshedAt: string;
};

type CatalogSummaryForExtract = Pick<
  CatalogCardSummary,
  "name" | "number" | "rarity" | "set"
>;

export function catalogSummaryToExtractedCard(
  card: CatalogSummaryForExtract,
  options?: { gradeCard?: ExtractedCard | null },
): ExtractedCard {
  const grade = options?.gradeCard;
  return extractedCardSchema.parse({
    franchise: "pokemon",
    name: card.name,
    printedName: card.name,
    set: card.set?.name ?? card.set?.code ?? undefined,
    number: card.number ?? undefined,
    year: card.set?.releaseDate?.slice(0, 4) ?? undefined,
    rarity: card.rarity ?? undefined,
    grader: grade?.grader,
    grade: grade?.grade,
    cert: grade?.cert,
    printStamps: grade?.printStamps,
    details: grade?.details,
    encapsulation: grade?.encapsulation,
  });
}
