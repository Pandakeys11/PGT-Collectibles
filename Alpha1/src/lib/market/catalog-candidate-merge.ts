import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import type { CatalogCandidate, CatalogIdentityStatus } from "@/lib/scan/schemas";

export const MAX_CATALOG_CANDIDATES = 16;

function pickTopMatch(a: CatalogMatch, b: CatalogMatch): CatalogMatch {
  const rank = (m: CatalogMatch) => {
    const statusRank: Record<CatalogIdentityStatus, number> = {
      confirmed: 4,
      likely: 3,
      ambiguous: 2,
      failed: 1,
    };
    return statusRank[m.catalogIdentityStatus] * 1000 + m.score;
  };
  return rank(a) >= rank(b) ? a : b;
}

function printVariantRank(row: CatalogCandidate): number {
  return row.reasons.includes("print_variant") ? 1 : 0;
}

function hardConflictCount(row: CatalogCandidate): number {
  return row.conflicts.filter((conflict) => /^(name|number|print_variant)$/i.test(conflict)).length;
}

function reasonRank(row: CatalogCandidate): number {
  return (
    (row.reasons.includes("number_ocr_corrected") ? 5 : 0) +
    (row.reasons.includes("denominator") ? 4 : 0) +
    (row.reasons.includes("number") ? 3 : 0) +
    (row.reasons.includes("set") ? 2 : 0) +
    (row.reasons.includes("year") ? 1 : 0) +
    printVariantRank(row)
  );
}

function promotedStatus(
  winner: CatalogMatch,
  bestCandidate: CatalogCandidate | undefined,
): CatalogMatch["catalogIdentityStatus"] {
  if (!bestCandidate) return winner.catalogIdentityStatus;
  const hasHardConflict = bestCandidate.conflicts.some((conflict) =>
    /name|number|set|print_variant/i.test(conflict),
  );
  if (!hasHardConflict && bestCandidate.score >= 90) return "confirmed";
  if (printVariantRank(bestCandidate) && bestCandidate.score >= 82 && !hasHardConflict) {
    return "confirmed";
  }
  return winner.catalogIdentityStatus;
}

/** Merge candidate lists; keep the strongest row per catalogId. */
export function mergeCatalogMatches(
  primary: CatalogMatch | null,
  secondary: CatalogMatch | null,
): CatalogMatch | null {
  if (!primary) return secondary;
  if (!secondary) return primary;

  const byId = new Map<string, CatalogCandidate>();
  for (const row of [...primary.candidates, ...secondary.candidates]) {
    const existing = byId.get(row.catalogId);
    if (!existing || row.score > existing.score) byId.set(row.catalogId, row);
  }

  const candidates = [...byId.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        hardConflictCount(a) - hardConflictCount(b) ||
        reasonRank(b) - reasonRank(a) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_CATALOG_CANDIDATES);

  const top = pickTopMatch(primary, secondary);
  const bestCandidate = candidates[0];
  const useSecondaryTop =
    bestCandidate &&
    secondary.candidates.some((c) => c.catalogId === bestCandidate.catalogId) &&
    (!primary.candidates[0] || bestCandidate.score > primary.candidates[0].score);

  const winner = useSecondaryTop ? secondary : top;

  return {
    ...winner,
    catalogId: bestCandidate?.catalogId ?? winner.catalogId,
    name: bestCandidate?.name ?? winner.name,
    setName: bestCandidate?.setName ?? winner.setName,
    cardNumber: bestCandidate?.cardNumber ?? winner.cardNumber,
    year: bestCandidate?.year ?? winner.year,
    rarity: bestCandidate?.rarity ?? winner.rarity,
    imageSmallUrl: bestCandidate?.imageSmallUrl ?? winner.imageSmallUrl,
    imageLargeUrl: bestCandidate?.imageLargeUrl ?? winner.imageLargeUrl,
    imageUrl:
      bestCandidate?.imageLargeUrl ??
      bestCandidate?.imageSmallUrl ??
      winner.imageUrl,
    catalogIdentityStatus: promotedStatus(winner, bestCandidate),
    score: bestCandidate?.score ?? winner.score,
    catalogConfidence: bestCandidate?.confidence ?? winner.catalogConfidence,
    candidates,
    identityEvidence:
      winner.identityEvidence.length > 0
        ? winner.identityEvidence
        : top.identityEvidence,
  };
}
