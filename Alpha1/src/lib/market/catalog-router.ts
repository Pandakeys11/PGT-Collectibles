import { searchDbCatalog } from "@/lib/catalog/db-catalog";
import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { matchGenericCatalog } from "@/lib/market/generic-catalog";
import { matchLorcanaCatalog } from "@/lib/market/lorcana-catalog";
import { matchOnepieceCatalog } from "@/lib/market/onepiece-catalog";
import { matchPokemonCatalog } from "@/lib/market/pokemon-catalog";
import { matchScryfallCatalog } from "@/lib/market/scryfall-catalog";
import { matchYugiohCatalog } from "@/lib/market/yugioh-catalog";
import { inferCardFranchise, type CardFranchise } from "@/lib/scan/franchise";
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

function cacheMatchIsStrongEnough(match: CatalogMatch | null): boolean {
  if (!match) return false;
  if (match.catalogIdentityStatus === "confirmed") return true;
  return match.score >= 82 && match.catalogIdentityStatus === "likely";
}

/**
 * Franchise-aware catalog resolution (fast path first):
 * 1) Supabase tcg_catalog_cards cache when synced
 * 2) Live official API only when cache misses or is weak
 * 3) Generic web fallback via matchCatalogWithFallback
 */
export async function matchDedicatedCatalog(card: ExtractedCard): Promise<CatalogMatch | null> {
  const franchise = inferCardFranchise(card).id;
  const cached = await searchDbCatalog(card, franchise);
  if (cacheMatchIsStrongEnough(cached)) return cached;

  const live = await matchFranchiseLive(card, franchise);
  const merged = pickStronger(live, cached);
  if (merged) return merged;

  return cached;
}

export async function matchCatalogWithFallback(card: ExtractedCard): Promise<CatalogMatch | null> {
  const dedicated = await matchDedicatedCatalog(card);
  if (dedicated?.catalogIdentityStatus === "confirmed") return dedicated;
  const generic = await matchGenericCatalog(card);
  return pickStronger(dedicated, generic);
}
