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
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
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
    score: bestCandidate?.score ?? winner.score,
    catalogConfidence: bestCandidate?.confidence ?? winner.catalogConfidence,
    candidates,
    identityEvidence:
      winner.identityEvidence.length > 0
        ? winner.identityEvidence
        : top.identityEvidence,
  };
}
