import { getCardFromDb, getCardFromDbBySetNumber } from "@/lib/catalog/db-catalog-browse";
import {
  parsePokemonCatalogSku,
  pokemonCatalogIdFromSku,
} from "@/lib/catalog/parse-catalog-sku";
import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import {
  catalogCardReferenceEvidence,
  parseCatalogPriceSnapshot,
} from "@/lib/market/catalog-reference-evidence";
import {
  catalogRawFmvToFairValueBasis,
  resolveCatalogRawFmv,
} from "@/lib/market/catalog-raw-fmv";
import { deriveFairValueResult, type FairValueBasis } from "@/lib/market/fair-value";
import {
  analyzeMarketEvidence,
  type MarketIntelligence,
} from "@/lib/market/market-intelligence";
import {
  hasInstitutionalMarketMemory,
  intelCompsToMarketEvidence,
  loadPersistedMarketEvidence,
} from "@/lib/market/persisted-market-evidence";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import type { CatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
import { readCatalogMarketIntel } from "@/lib/pgt-registry/pgt-market-intel-persist";
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

function catalogVariantEditionHints(
  catalogId: string,
): Pick<ExtractedCard, "printStamps" | "details"> {
  if (catalogId.includes("__first_edition")) {
    return { printStamps: "1st Edition", details: "1st Edition" };
  }
  if (catalogId.includes("__shadowless")) {
    return { printStamps: "Shadowless", details: "Shadowless" };
  }
  if (catalogId.includes("__unlimited")) {
    return { printStamps: "Unlimited", details: "Unlimited" };
  }
  return {};
}

export function catalogSummaryToExtractedCard(
  card: CatalogCardSummary,
  options?: { gradeCard?: ExtractedCard | null },
): ExtractedCard {
  const grade = options?.gradeCard;
  const variantEdition = catalogVariantEditionHints(card.id);
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
    printStamps: grade?.printStamps ?? variantEdition.printStamps,
    details: grade?.details ?? variantEdition.details,
    encapsulation: grade?.encapsulation,
  });
}

/**
 * Unified read model: catalog spine + institutional comps + reference prices + FMV intelligence.
 * This is the backend “market master” view for a locked `catalog_id`.
 */
export async function buildPokemonMarketKnowledge(
  catalogId: string,
  options?: {
    compLimit?: number;
    /** When grading context is known (scan/slab), scopes FMV to that lane. */
    gradeCard?: ExtractedCard | null;
    extraEvidence?: MarketEvidence[];
  },
): Promise<PokemonMarketKnowledge | null> {
  const raw = catalogId.trim();
  if (!raw) return null;

  const canonical = pokemonCatalogIdFromSku(raw) ?? raw;
  const compLimit = Math.min(100, Math.max(1, options?.compLimit ?? 48));

  let catalogCard = await getCardFromDb("pokemon", canonical);
  if (!catalogCard) {
    const parsed = parsePokemonCatalogSku(raw);
    if (parsed?.kind === "set_number") {
      catalogCard = await getCardFromDbBySetNumber(
        "pokemon",
        parsed.setCode,
        parsed.cardNumber,
      );
    }
  }

  const resolvedId = catalogCard?.id ?? canonical;

  const [_, loaded] = await Promise.all([
    Promise.resolve(catalogCard),
    loadPersistedMarketEvidence(resolvedId, { compLimit }),
  ]);

  const referencePrices = catalogCard?.prices ?? parseCatalogPriceSnapshot(null);

  const catalogRef = catalogCard ? catalogCardReferenceEvidence(catalogCard) : [];
  const extra = options?.extraEvidence ?? [];
  const seen = new Set<string>();
  const marketEvidence: MarketEvidence[] = [];
  for (const row of [...loaded.evidence, ...catalogRef, ...extra]) {
    const key = `${row.kind}|${row.url ?? ""}|${row.title}|${row.priceUsd ?? ""}|${row.observedAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    marketEvidence.push(row);
  }

  const gradeCard =
    options?.gradeCard ??
    (catalogCard ? catalogSummaryToExtractedCard(catalogCard) : null);

  const isRawContext = !gradeCard?.grader && !gradeCard?.grade;
  const rawFmv = resolveCatalogRawFmv({
    prices: referencePrices,
    marketEvidence,
    catalogFinish: catalogCard?.catalogFinish,
    rarity: catalogCard?.rarity,
    identity: catalogCard
      ? {
          name: catalogCard.name,
          number: catalogCard.number,
          set: catalogCard.set?.name ?? catalogCard.set?.code ?? null,
        }
      : gradeCard
        ? {
            name: gradeCard.name ?? gradeCard.printedName,
            number: gradeCard.number,
            set: gradeCard.set,
          }
        : null,
  });

  const { fairValueUsd: compFmv, fairValueBasis: compBasis } = deriveFairValueResult(
    marketEvidence,
    {
      card: gradeCard,
      gradeCard: gradeCard ?? undefined,
      targetGradeBucket: gradeCard ? undefined : "raw",
    },
  );

  const fairValueUsd = isRawContext
    ? (rawFmv.usd ?? compFmv)
    : compFmv;
  const fairValueBasis = isRawContext
    ? (catalogRawFmvToFairValueBasis(rawFmv.basis) ?? compBasis)
    : compBasis;

  const intelligence = analyzeMarketEvidence(marketEvidence, {
    card: gradeCard,
    gradeCard: gradeCard ?? undefined,
  });

  const intel =
    loaded.intel ??
    (await readCatalogMarketIntel(resolvedId, { compLimit }));

  return {
    catalogId: resolvedId,
    card: catalogCard
      ? {
          name: catalogCard.name,
          setName: catalogCard.set?.name ?? null,
          setCode: catalogCard.set?.code ?? null,
          number: catalogCard.number,
          year: catalogCard.set?.releaseDate?.slice(0, 4) ?? null,
          rarity: catalogCard.rarity,
          imageSmallUrl: catalogCard.images?.small ?? null,
          imageLargeUrl: catalogCard.images?.large ?? null,
        }
      : null,
    referencePrices,
    intel,
    marketEvidence,
    intelligence,
    fairValueUsd,
    fairValueBasis,
    rawFmvUsd: rawFmv.usd,
    rawFmvBasis: catalogRawFmvToFairValueBasis(rawFmv.basis),
    tcgPlayerUsd: rawFmv.tcgPlayerUsd,
    priceChartingUsd: rawFmv.priceChartingUsd,
    rawFmvSourceLabel: rawFmv.sourceLabel,
    institutionalMemory: hasInstitutionalMarketMemory(marketEvidence),
    dataDepth: {
      persistedComps: intel?.comps.length ?? 0,
      catalogReferenceRows: catalogRef.length,
      populationSnapshots: intel?.population.length ?? 0,
      certifications: intel?.certifications.length ?? 0,
    },
    refreshedAt: new Date().toISOString(),
  };
}

export { intelCompsToMarketEvidence, loadPersistedMarketEvidence, hasInstitutionalMarketMemory };
