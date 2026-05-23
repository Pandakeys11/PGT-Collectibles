import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import type { BuiltScanSpecimen } from "@/lib/scan/build-specimens";
import { buildScanCardContext } from "@/lib/scan/context-builder";
import type { ExtractedCard } from "@/lib/scan/schemas";

function makeId() {
  return `catalog-${crypto.randomUUID()}`;
}

export function buildSpecimenFromCatalogPrefill(prefill: CatalogScanPrefill): BuiltScanSpecimen {
  const id = makeId();
  const card: ExtractedCard = {
    franchise: prefill.franchise,
    name: prefill.name,
    set: prefill.set,
    number: prefill.number,
    year: prefill.year,
    rarity: prefill.rarity,
    printStamps: prefill.printStamps,
    encapsulation: "raw",
    visionLane: "raw",
  };

  const context = buildScanCardContext({
    specimenId: id,
    card,
    catalogId: prefill.catalogId,
    catalogIdentityStatus: "confirmed",
    catalogConfidence: 1,
    catalogImageUrl: prefill.catalogImageUrl ?? null,
    year: prefill.year ?? null,
  });

  return {
    id,
    card,
    context,
    previewUrl: null,
    evidenceCropLocation: null,
    userEvidenceCropCenter: null,
    userEvidenceCropRadiusMultiplier: null,
  };
}
