import type { BuiltScanSpecimen } from "@/lib/scan/build-specimens";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
import { displayPrintVersion } from "@/lib/scan/display-print-edition";
import { buildSpecimenMarketView, formatMarketUsd } from "@/lib/scan/specimen-market-view";
import type { PokeGradeHudSnapshot } from "@/lib/pokegrade/types";

function formatGradeLine(specimen: BuiltScanSpecimen): string | null {
  const { grader, grade, cert } = specimen.card;
  const parts: string[] = [];
  if (grader) parts.push(grader);
  if (grade) parts.push(grade);
  if (cert) parts.push(`#${cert}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function buildHudFromSpecimen(
  specimen: BuiltScanSpecimen,
  provider: PokeGradeHudSnapshot["provider"] = "pgt",
): PokeGradeHudSnapshot {
  const view = buildSpecimenMarketView(specimen);
  const psa10 = view?.premiumGrades.find((row) => row.bucket === "psa10");
  const latestPsa10Sold = psa10?.latestSold ?? null;

  const edition = displayPrintVersion(specimen.card);
  const setLine = [specimen.card.set, specimen.card.number, edition]
    .filter(Boolean)
    .join(" · ");

  const evidence = specimen.context.marketEvidence ?? [];
  const compsCount = evidence.filter((row) => row.priceUsd != null && row.priceUsd > 0).length;

  return {
    cardName: getCardDisplayTitle(specimen.card),
    subtitle: setLine || "Set resolving…",
    gradeLine: formatGradeLine(specimen),
    fairValueUsd: specimen.context.fairValueUsd ?? view?.intel.fmvUsd ?? null,
    fairValueBasis: specimen.context.fairValueBasis ?? view?.intel.fmvBasis ?? null,
    psa10SoldUsd: latestPsa10Sold?.priceUsd ?? psa10?.fmvUsd ?? null,
    psa10SoldLabel: latestPsa10Sold
      ? `PSA 10 sold ${formatMarketUsd(latestPsa10Sold.priceUsd)}`
      : psa10?.fmvUsd != null
        ? `PSA 10 FMV ${formatMarketUsd(psa10.fmvUsd)}`
        : null,
    provider,
    catalogImageUrl: specimen.context.catalogImageUrl ?? null,
    capturePreviewUrl: specimen.previewUrl ?? null,
    compsCount,
    catalogVerified: Boolean(specimen.context.catalogId),
    rarity: specimen.card.rarity ?? null,
  };
}
