import { searchDbCatalog, searchDbCatalogBroad } from "@/lib/catalog/db-catalog";
import { mergeCatalogMatches } from "@/lib/market/catalog-candidate-merge";
import { matchCatalogForEnrich } from "@/lib/market/catalog-router";
import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { inferCardFranchise } from "@/lib/scan/franchise";
import { toCatalogCounterpartCard } from "@/lib/scan/japanese-pokemon";
import { isNonTcgPokemonCollectible } from "@/lib/scan/non-tcg-pokemon";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** Minimum pick rows shown in Catalog Match UI (auto-match may still be uncertain). */
export const MIN_CATALOG_PICK_OPTIONS = 3;

function candidateCount(match: CatalogMatch | null): number {
  return match?.candidates.length ?? 0;
}

function topCandidateHasHardConflict(match: CatalogMatch | null): boolean {
  const top = match?.candidates[0];
  return Boolean(top?.conflicts.some((conflict) => /^(name|number|print_variant)$/i.test(conflict)));
}

function dbMatchIsUsable(match: CatalogMatch | null): boolean {
  if (!match || candidateCount(match) === 0) return false;
  if (match.catalogIdentityStatus === "confirmed") return true;
  if (candidateCount(match) >= MIN_CATALOG_PICK_OPTIONS && match.catalogIdentityStatus !== "failed") {
    return true;
  }
  return match.score >= 72 && match.catalogIdentityStatus !== "failed";
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Resolve catalog match + surface pick options for manual review.
 * Master DB first; live fallback is bounded and only used when the DB has no usable answer.
 */
export async function ensureCatalogMatchOptions(
  card: ExtractedCard,
  options?: { hintCatalogId?: string | null },
): Promise<CatalogMatch | null> {
  if (isNonTcgPokemonCollectible(card)) return null;

  const franchise = inferCardFranchise(card).id;
  const catalogCard = toCatalogCounterpartCard(card);
  let match = await searchDbCatalog(catalogCard, franchise);

  const hintCatalogId = options?.hintCatalogId?.trim();
  if (hintCatalogId && match?.candidates?.length) {
    const idx = match.candidates.findIndex((c) => c.catalogId === hintCatalogId);
    if (idx > 0) {
      const candidates = [...match.candidates];
      const [hit] = candidates.splice(idx, 1);
      candidates.unshift(hit);
      match = { ...match, catalogId: hintCatalogId, candidates };
    } else if (idx === 0 && !match.catalogId) {
      match = { ...match, catalogId: hintCatalogId };
    }
  }

  const skipBroad =
    match?.catalogIdentityStatus === "confirmed" &&
    (match.score ?? 0) >= 85 &&
    !topCandidateHasHardConflict(match);

  if (
    !skipBroad &&
    (candidateCount(match) < MIN_CATALOG_PICK_OPTIONS || topCandidateHasHardConflict(match))
  ) {
    const dbBroad = await searchDbCatalogBroad(catalogCard, franchise);
    match = mergeCatalogMatches(match, dbBroad);
  }

  if (dbMatchIsUsable(match)) {
    return match;
  }

  const fallback = await withTimeout(matchCatalogForEnrich(catalogCard), 8_000, null);
  return mergeCatalogMatches(match, fallback);
}
