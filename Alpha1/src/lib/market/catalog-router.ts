import { searchDbCatalog } from "@/lib/catalog/db-catalog";
import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { matchGenericCatalog } from "@/lib/market/generic-catalog";
import { matchLorcanaCatalog } from "@/lib/market/lorcana-catalog";
import { matchOnepieceCatalog } from "@/lib/market/onepiece-catalog";
import {
  matchPokemonCatalog,
  suggestPokemonCatalogCandidates,
} from "@/lib/market/pokemon-catalog";
import { mergeCatalogMatches } from "@/lib/market/catalog-candidate-merge";
import { matchScryfallCatalog } from "@/lib/market/scryfall-catalog";
import { matchYugiohCatalog } from "@/lib/market/yugioh-catalog";
import { inferCardFranchise, type CardFranchise } from "@/lib/scan/franchise";
import { isNonTcgPokemonCollectible } from "@/lib/scan/non-tcg-pokemon";
import type { ExtractedCard } from "@/lib/scan/schemas";

function pickStronger(a: CatalogMatch | null, b: CatalogMatch | null): CatalogMatch | null {
  if (!a) return b;
  if (!b) return a;
  const rank = (m: CatalogMatch) => {
    const statusRank =
      m.catalogIdentityStatus === "confirmed"
        ? 4
        : m.catalogIdentityStatus === "likely"
          ? 3
          : m.catalogIdentityStatus === "ambiguous"
            ? 2
            : 1;
    return statusRank * 1000 + m.score;
  };
  return rank(a) >= rank(b) ? a : b;
}

async function matchFranchiseLive(
  card: ExtractedCard,
  franchise: CardFranchise,
): Promise<CatalogMatch | null> {
  switch (franchise) {
    case "pokemon":
      return matchPokemonCatalog(card);
    case "magic":
      return matchScryfallCatalog(card);
    case "yugioh":
      return matchYugiohCatalog(card);
    case "onepiece":
      return matchOnepieceCatalog(card);
    case "lorcana":
      return matchLorcanaCatalog(card);
    case "dragonball":
    case "sports":
    case "other":
      return null;
    default:
      return null;
  }
}

function cacheMatchIsStrongEnough(
  match: CatalogMatch | null,
  franchise?: CardFranchise,
): boolean {
  if (!match) return false;
  if (match.catalogIdentityStatus === "confirmed") return true;
  if (match.candidates[0]?.conflicts?.includes("name conflict")) return false;
  const fractionEvidence = match.identityEvidence.some(
    (row) => row.field === "set total" && row.status === "match",
  );
  if (fractionEvidence && match.score >= 78 && match.catalogIdentityStatus === "likely") {
    return true;
  }
  if (
    franchise === "pokemon" &&
    match.catalogIdentityStatus === "likely" &&
    match.score >= 70
  ) {
    return true;
  }
  return match.score >= 82 && match.catalogIdentityStatus === "likely";
}

/**
 * Franchise-aware catalog resolution (fast path first):
 * 1) Supabase tcg_catalog_cards cache when synced
 * 2) Live official API only when cache misses or is weak
 * 3) Generic web fallback via matchCatalogWithFallback
 */
export async function matchDedicatedCatalog(card: ExtractedCard): Promise<CatalogMatch | null> {
  if (isNonTcgPokemonCollectible(card)) return null;
  const franchise = inferCardFranchise(card).id;
  const cached = await searchDbCatalog(card, franchise);
  if (cacheMatchIsStrongEnough(cached, franchise)) return cached;

  const live = await matchFranchiseLive(card, franchise);
  const merged = pickStronger(live, cached);
  if (merged) return merged;

  return cached;
}

export async function matchCatalogWithFallback(card: ExtractedCard): Promise<CatalogMatch | null> {
  if (isNonTcgPokemonCollectible(card)) return null;
  const dedicated = await matchDedicatedCatalog(card);
  if (dedicated?.catalogIdentityStatus === "confirmed") return dedicated;
  const generic = await matchGenericCatalog(card);
  let merged = pickStronger(dedicated, generic);
  if (merged && merged.candidates.length > 0) return merged;

  const franchise = inferCardFranchise(card).id;
  const cached = await searchDbCatalog(card, franchise);
  if (cached) merged = pickStronger(merged, cached);
  if (merged && merged.candidates.length > 0) return merged;

  if (franchise === "pokemon") {
    const wide = await suggestPokemonCatalogCandidates(card);
    if (wide) return wide;
  }
  return merged ?? cached;
}

function needsMoreCatalogOptions(match: CatalogMatch | null): boolean {
  if (!match) return true;
  if (match.candidates.length === 0) return true;
  // If we already have a confirmed identity, avoid expensive deep widen (live API + web).
  // Users can still manually request more candidates from the UI when needed.
  if (match.catalogIdentityStatus === "confirmed") return false;
  return true;
}

function confirmedPrintVariantMatch(match: CatalogMatch | null): boolean {
  return Boolean(
    match?.catalogIdentityStatus === "confirmed" &&
      match.candidates[0]?.reasons?.includes("print_variant"),
  );
}

/** Enrich + manual-pick: widen candidate list from master catalog / cache. */
export async function suggestCatalogCandidates(
  card: ExtractedCard,
): Promise<CatalogMatch | null> {
  if (isNonTcgPokemonCollectible(card)) return null;
  const franchise = inferCardFranchise(card).id;
  const cached = await searchDbCatalog(card, franchise);
  if (confirmedPrintVariantMatch(cached)) return cached;

  let live: CatalogMatch | null = null;
  if (franchise === "pokemon") {
    live = await suggestPokemonCatalogCandidates(card);
  } else {
    live = await matchFranchiseLive(card, franchise);
  }

  let merged = mergeCatalogMatches(live, cached);
  if ((!merged || merged.candidates.length < 3) && cached) {
    merged = mergeCatalogMatches(merged, cached);
  }
  if (needsMoreCatalogOptions(merged)) {
    const generic = await matchGenericCatalog(card);
    merged = mergeCatalogMatches(merged, generic);
  }
  return merged;
}

/** Fast match, then deep suggestion pass when identity is weak or options are thin. */
export async function matchCatalogForEnrich(card: ExtractedCard): Promise<CatalogMatch | null> {
  const franchise = inferCardFranchise(card).id;
  const base = await matchCatalogWithFallback(card);
  if (
    franchise === "pokemon" &&
    base &&
    base.candidates.length > 0 &&
    base.score >= 65 &&
    base.catalogIdentityStatus !== "failed"
  ) {
    return base;
  }
  if (!needsMoreCatalogOptions(base)) return base;

  const wider = await suggestCatalogCandidates(card);
  return mergeCatalogMatches(base, wider);
}
