import { buildScanCardContext } from "@/lib/scan/context-builder";
import type { ScanCardContext } from "@/lib/scan/schemas";
import { parseSlabzCardToExtractedCard } from "@/lib/slabz/card-identity";
import { catalogIdForSlabzCard } from "@/lib/slabz/catalog-id";
import type { SlabzPack, SlabzRipRecord } from "@/lib/slabz/types";

export type SlabzRipSpecimen = {
  specimenId: string;
  card: ReturnType<typeof parseSlabzCardToExtractedCard>;
  context: ScanCardContext;
};

export function buildSlabzRipSpecimen(
  rip: SlabzRipRecord,
  pack?: SlabzPack | null,
): SlabzRipSpecimen {
  if (!rip.card) {
    throw new Error("This rip has no revealed slab yet");
  }

  const specimenId = `slabz-${rip.slabzTransactionId}`;
  const catalogId = catalogIdForSlabzCard(rip.card, rip.slabzTransactionId);
  const card = parseSlabzCardToExtractedCard(rip.card, { packName: rip.packName, pack });
  const fmvUsd = rip.card.insuredValueCents != null ? rip.card.insuredValueCents / 100 : null;

  const context = buildScanCardContext({
    specimenId,
    card,
    catalogId,
    catalogIdentityStatus: "confirmed",
    catalogConfidence: 1,
    catalogImageUrl: rip.card.imageUrl ?? null,
    fairValueUsd: fmvUsd,
    fairValueBasis: "tcg_catalog",
  });

  const extraction = {
    ...(context.extraction as Record<string, unknown>),
    partner: "slabz",
    slabzTransactionId: rip.slabzTransactionId,
    packId: rip.packId,
    nftMint: rip.card.nftMint,
    imageBackUrl: rip.card.imageBackUrl ?? null,
    slabzCard: rip.card,
    slabzImageUrl: rip.card.imageUrl,
  };

  return {
    specimenId,
    card,
    context: { ...context, extraction },
  };
}
