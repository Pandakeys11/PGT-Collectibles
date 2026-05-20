import type { ScanCardContext } from "@/lib/scan/schemas";
import { NARRATION_TODAY_ISO } from "@/lib/scan/narration-brief";

const MAX_EVIDENCE = 12;
const MAX_CATALOG_CANDIDATES = 3;
const MAX_IDENTITY_EVIDENCE = 8;

/** Compact context for narration/chat LLMs — stays under small-model TPM limits. */
export function buildNarrationLlmContext(context: ScanCardContext): Record<string, unknown> {
  const extraction = context.extraction as Record<string, unknown>;
  const slimExtraction: Record<string, unknown> = {
    name: extraction.name,
    set: extraction.set,
    number: extraction.number,
    year: extraction.year,
    grader: extraction.grader,
    grade: extraction.grade,
    cert: extraction.cert,
    printStamps: extraction.printStamps,
    extractedPrice: extraction.extractedPrice,
    encapsulation: extraction.encapsulation,
    visionLane: extraction.visionLane,
  };

  return {
    specimenId: context.specimenId,
    asOf: context.marketAsOf,
    todayUtc: NARRATION_TODAY_ISO,
    identity: {
      name: context.name,
      setName: context.setName,
      cardNumber: context.cardNumber,
      year: context.year,
      variantLabel: context.variantLabel,
      lane: context.lane,
      encapsulation: context.encapsulation,
    },
    catalog: {
      catalogId: context.catalogId,
      status: context.catalogIdentityStatus,
      confidence: context.catalogConfidence,
      candidates: context.catalogCandidates.slice(0, MAX_CATALOG_CANDIDATES).map((c) => ({
        name: c.name,
        setName: c.setName,
        cardNumber: c.cardNumber,
        score: c.score,
        confidence: c.confidence,
      })),
      identityEvidence: context.identityEvidence.slice(0, MAX_IDENTITY_EVIDENCE),
    },
    verificationStatus: context.verificationStatus,
    confidence: context.confidence,
    blockers: context.blockers,
    verificationFields: context.verificationFields,
    valuation: {
      fairValueUsd: context.fairValueUsd,
      fairValueBasis: context.fairValueBasis ?? null,
      askingUsd: context.askingUsd,
      anchorUsd: context.anchorUsd,
    },
    gradedSupply: context.populationSummary,
    registryUrl: context.registryUrl,
    marketEvidence: context.marketEvidence.slice(0, MAX_EVIDENCE).map((e) => ({
      kind: e.kind,
      title: e.title.length > 120 ? `${e.title.slice(0, 117)}…` : e.title,
      priceUsd: e.priceUsd,
      observedAt: e.observedAt,
      source: e.source ?? null,
      slab: e.slab ?? null,
    })),
    marketSourceLinks: context.marketSourceLinks.map((l) => ({
      source: l.source,
      label: l.label,
      lane: l.lane,
    })),
    extraction: slimExtraction,
  };
}
