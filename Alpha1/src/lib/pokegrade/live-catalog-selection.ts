import { buildScanCardContext } from "@/lib/scan/context-builder";
import { normalizeGradedSlabFields } from "@/lib/scan/graded-slab";
import type { BuiltScanSpecimen } from "@/lib/scan/build-specimens";
import {
  extractedCardSchema,
  type CatalogCandidate,
} from "@/lib/scan/schemas";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import { buildHudFromSpecimen } from "@/lib/pokegrade/hud-from-specimen";

function buildConfirmedCardFromCandidate(
  card: BuiltScanSpecimen["card"],
  candidate: CatalogCandidate,
  lane: BuiltScanSpecimen["context"]["lane"],
) {
  return normalizeGradedSlabFields(
    extractedCardSchema.parse({
      ...card,
      name: candidate.name || card.name,
      set: candidate.setName ?? card.set,
      number: candidate.cardNumber ?? card.number,
      year: candidate.year ?? card.year,
      rarity: candidate.rarity ?? card.rarity,
    }),
    lane,
  );
}

function toLiveResult(specimen: BuiltScanSpecimen, previewUrl: string): LiveScanResult {
  return {
    specimen: { ...specimen, previewUrl },
    previewUrl,
    hud: buildHudFromSpecimen({ ...specimen, previewUrl }, "pgt"),
  };
}

export function applyLiveCatalogReject(
  result: LiveScanResult,
  catalogId: string,
): LiveScanResult {
  const { specimen, previewUrl } = result;
  const remainingCandidates = specimen.context.catalogCandidates.filter(
    (entry) => entry.catalogId !== catalogId,
  );
  const nextBest = remainingCandidates[0] ?? null;
  const rejectingActive = specimen.context.catalogId === catalogId;
  const nextCatalogId = rejectingActive ? null : specimen.context.catalogId;
  const nextStatus =
    nextCatalogId != null
      ? specimen.context.catalogIdentityStatus
      : remainingCandidates.length > 0
        ? "ambiguous"
        : "failed";
  const nextConfidence =
    nextCatalogId != null
      ? specimen.context.catalogConfidence
      : (nextBest?.confidence ?? 0);
  const nextPreviewUrl = rejectingActive
    ? (nextBest?.imageSmallUrl ?? nextBest?.imageLargeUrl ?? null)
    : (specimen.context.catalogImageUrl ?? null);

  const updated: BuiltScanSpecimen = {
    ...specimen,
    context: buildScanCardContext({
      specimenId: specimen.id,
      card: specimen.card,
      catalogId: nextCatalogId,
      catalogIdentityStatus: nextStatus,
      catalogConfidence: nextConfidence,
      catalogCandidates: remainingCandidates,
      catalogImageUrl: nextPreviewUrl,
      identityEvidence: specimen.context.identityEvidence,
      marketEvidence: specimen.context.marketEvidence,
      marketSourceLinks: specimen.context.marketSourceLinks,
      fairValueUsd: specimen.context.fairValueUsd,
      fairValueBasis: specimen.context.fairValueBasis,
      year: specimen.context.year,
    }),
  };

  return toLiveResult(updated, previewUrl);
}

export function applyLiveCatalogConfirm(
  result: LiveScanResult,
  candidate: CatalogCandidate,
): LiveScanResult {
  const { specimen, previewUrl } = result;
  const lane = specimen.context.lane ?? "raw";
  const confirmedCard = buildConfirmedCardFromCandidate(specimen.card, candidate, lane);
  const catalogImageUrl = candidate.imageSmallUrl ?? candidate.imageLargeUrl ?? null;
  const orderedCandidates = [
    candidate,
    ...specimen.context.catalogCandidates.filter(
      (entry) => entry.catalogId !== candidate.catalogId,
    ),
  ];

  const updated: BuiltScanSpecimen = {
    ...specimen,
    card: confirmedCard,
    context: buildScanCardContext({
      specimenId: specimen.id,
      card: confirmedCard,
      catalogId: candidate.catalogId,
      catalogIdentityStatus: "confirmed",
      catalogConfidence: 1,
      catalogCandidates: orderedCandidates,
      catalogImageUrl,
      identityEvidence: specimen.context.identityEvidence,
      marketEvidence: specimen.context.marketEvidence,
      marketSourceLinks: specimen.context.marketSourceLinks,
      fairValueUsd: specimen.context.fairValueUsd,
      fairValueBasis: specimen.context.fairValueBasis,
      year: confirmedCard.year ?? specimen.context.year,
    }),
  };

  return toLiveResult(updated, previewUrl);
}
