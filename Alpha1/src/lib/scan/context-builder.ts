import type { FairValueBasis } from "@/lib/market/fair-value";
import {
  hasReadableCertNumber,
  isCertNotApplicable,
  normalizeGradedSlabFields,
} from "@/lib/scan/graded-slab";
import { classifyCardLane, scrubHallucinatedSlabFieldsForRaw } from "@/lib/scan/lane";
import { printEditionBlocker, resolvePrintEdition } from "@/lib/scan/print-edition";
import { franchiseLabel } from "@/lib/scan/franchise";
import { buildEbaySoldSearchUrl, buildEbayActiveSearchUrl, buildMarketSourceLinks } from "@/lib/market/sources";
import type {
  CatalogCandidate,
  CatalogIdentityStatus,
  ExtractedCard,
  IdentityEvidence,
  MarketEvidence,
  MarketSourceLink,
  ScanCardContext,
} from "@/lib/scan/schemas";
import {
  buildVerificationFields,
  deriveConfidence,
  deriveVerificationStatus,
  type RegistrySnapshot,
} from "@/lib/scan/verification";

function ebaySearchUrl(query: string, sold: boolean): string {
  return sold ? buildEbaySoldSearchUrl(query) : buildEbayActiveSearchUrl(query);
}

function buildSearchQuery(card: ExtractedCard): string {
  return [card.name, card.printedName, card.language, card.set, card.number, card.year, card.printStamps, card.grader, card.grade]
    .filter(Boolean)
    .join(" ");
}

export function buildScanCardContext(args: {
  specimenId: string;
  card: ExtractedCard;
  registry?: RegistrySnapshot | null;
  populationSummary?: string | null;
  certProvider?: string | null;
  certGradeDate?: string | null;
  certMarketEvidence?: MarketEvidence[];
  catalogId?: string | null;
  year?: string | null;
  marketEvidence?: MarketEvidence[];
  marketSourceLinks?: MarketSourceLink[];
  fairValueUsd?: number | null;
  fairValueBasis?: FairValueBasis | null;
  catalogImageUrl?: string | null;
  catalogImageSource?: ScanCardContext["catalogImageSource"];
  catalogImageSourceLabel?: string | null;
  catalogImageNeedsReview?: boolean;
  catalogIdentityStatus?: CatalogIdentityStatus;
  catalogConfidence?: number | null;
  catalogCandidates?: CatalogCandidate[];
  identityEvidence?: IdentityEvidence[];
}): ScanCardContext {
  const prepped = normalizeGradedSlabFields(args.card);
  const laneResult = classifyCardLane(cardRecordFromExtracted(prepped));
  const lane = laneResult.lane;
  const normalized =
    lane === "raw"
      ? (scrubHallucinatedSlabFieldsForRaw(prepped) as ExtractedCard)
      : normalizeGradedSlabFields(prepped, "graded");
  const verificationFields = buildVerificationFields(normalized, args.registry);
  const registryVerificationStatus = deriveVerificationStatus(verificationFields);
  const registryConfidence = deriveConfidence(verificationFields, lane);
  const catalogAttempted =
    args.catalogIdentityStatus != null ||
    args.catalogCandidates != null ||
    args.identityEvidence != null;
  const catalogIdentityStatus: CatalogIdentityStatus =
    args.catalogIdentityStatus ?? (args.catalogId ? "confirmed" : "failed");
  const catalogConfidence = Math.max(0, Math.min(1, args.catalogConfidence ?? (args.catalogId ? 1 : 0)));
  const verificationStatus =
    registryVerificationStatus === "failed"
      ? "failed"
      : catalogIdentityStatus === "confirmed"
        ? "verified"
        : "partial";
  const confidence =
    catalogConfidence > 0
      ? Math.max(registryConfidence, catalogConfidence)
      : registryConfidence;
  const blockers: string[] = [];
  if (verificationFields.some((f) => f.status === "mismatch")) {
    blockers.push("Registry mismatch on one or more identity fields.");
  }
  if (catalogAttempted && catalogIdentityStatus === "ambiguous") {
    blockers.push("Catalog identity is ambiguous; review the candidate list before trusting this row.");
  }
  if (catalogAttempted && catalogIdentityStatus === "failed") {
    blockers.push("No official catalog candidate cleared the identity threshold.");
  }
  if (lane === "graded" && !hasReadableCertNumber(normalized.cert)) {
    blockers.push(
      isCertNotApplicable(normalized.cert)
        ? "Cert not visible in photo (often on back of slab) — enter cert # manually."
        : "Graded lane without a readable cert number.",
    );
  }
  const editionBlocker = printEditionBlocker(normalized, lane);
  if (editionBlocker) blockers.push(editionBlocker);
  const resolvedEdition = resolvePrintEdition(normalized);

  const query = buildSearchQuery(normalized);
  const marketEvidence = args.marketEvidence ?? [];
  const marketSourceLinks = args.marketSourceLinks ?? buildMarketSourceLinks(normalized);
  const askingUsd = typeof normalized.extractedPrice === "number" ? normalized.extractedPrice : null;
  const ebaySold = marketSourceLinks.find((link) => link.source === "ebay" && link.lane === "sold")?.url ?? null;
  const ebayActive = marketSourceLinks.find((link) => link.source === "ebay" && link.lane === "active")?.url ?? null;

  return {
    specimenId: args.specimenId,
    catalogId: args.catalogId ?? null,
    catalogIdentityStatus,
    catalogConfidence,
    catalogCandidates: args.catalogCandidates ?? [],
    identityEvidence: args.identityEvidence ?? [],
    name: normalized.name,
    setName: normalized.set ?? null,
    cardNumber: normalized.number ?? null,
    year: args.year ?? normalized.year ?? null,
    variantLabel:
      [
        franchiseLabel(normalized),
        resolvedEdition && resolvedEdition.id !== "unknown" ? resolvedEdition.label : null,
        normalized.language,
        normalized.japaneseName ? `Japanese: ${normalized.japaneseName}` : null,
        normalized.setNameEnglish ? `English counterpart: ${normalized.setNameEnglish}` : null,
        normalized.printedName,
        normalized.printStamps,
        normalized.details,
        normalized.rarity,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    encapsulation: lane === "graded" ? "graded_slab" : "raw",
    lane,
    fairValueUsd: args.fairValueUsd ?? null,
    fairValueBasis: args.fairValueBasis ?? null,
    anchorUsd: null,
    askingUsd,
    marketAsOf: new Date().toISOString(),
    verificationStatus,
    confidence,
    blockers,
    verificationFields,
    marketEvidence,
    marketSourceLinks,
    populationSummary:
      args.populationSummary ??
      (args.registry?.isVerified
        ? "Registry verified — open grader link for full population."
        : null),
    ebaySoldSearchUrl: ebaySold ?? (query ? ebaySearchUrl(query, true) : null),
    ebayActiveSearchUrl: ebayActive ?? (query ? ebaySearchUrl(query, false) : null),
    registryUrl: args.registry?.registryUrl ?? null,
    certProvider: args.certProvider ?? null,
    certGradeDate: args.certGradeDate ?? null,
    certMarketEvidence: args.certMarketEvidence ?? [],
    extraction: normalized,
    catalogImageUrl: args.catalogImageUrl ?? null,
    catalogImageSource: args.catalogImageSource ?? null,
    catalogImageSourceLabel: args.catalogImageSourceLabel ?? null,
    catalogImageNeedsReview: args.catalogImageNeedsReview ?? false,
  };
}

function cardRecordFromExtracted(card: ExtractedCard): Record<string, unknown> {
  return { ...card };
}

/** Catalog fields preserved when running market-only enrichment. */
export type CatalogContextSnapshot = Pick<
  ScanCardContext,
  | "catalogId"
  | "catalogIdentityStatus"
  | "catalogConfidence"
  | "catalogCandidates"
  | "identityEvidence"
  | "catalogImageUrl"
  | "catalogImageSource"
  | "catalogImageSourceLabel"
  | "catalogImageNeedsReview"
>;

export function pickCatalogContext(context: ScanCardContext): CatalogContextSnapshot {
  return {
    catalogId: context.catalogId,
    catalogIdentityStatus: context.catalogIdentityStatus,
    catalogConfidence: context.catalogConfidence,
    catalogCandidates: context.catalogCandidates,
    identityEvidence: context.identityEvidence,
    catalogImageUrl: context.catalogImageUrl ?? null,
    catalogImageSource: context.catalogImageSource ?? null,
    catalogImageSourceLabel: context.catalogImageSourceLabel ?? null,
    catalogImageNeedsReview: context.catalogImageNeedsReview ?? false,
  };
}

export function mergeCatalogIntoContext(
  context: ScanCardContext,
  catalog: Partial<CatalogContextSnapshot>,
): ScanCardContext {
  return {
    ...context,
    ...catalog,
    catalogCandidates: catalog.catalogCandidates ?? context.catalogCandidates,
    identityEvidence: catalog.identityEvidence ?? context.identityEvidence,
  };
}
