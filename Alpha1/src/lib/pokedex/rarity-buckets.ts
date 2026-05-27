/**
 * Maps Pokémon TCG API `rarity` strings into browse tabs (Lucene `q` on /v2/cards).
 * Unlisted rarities still appear under "All" only.
 * @see https://docs.pokemontcg.io/api-reference/cards/search-cards
 */

export type RarityBucketId = "all" | "base" | "rare" | "ultra" | "secret";

export const RARITY_TAB_ORDER: RarityBucketId[] = ["all", "base", "rare", "ultra", "secret"];

export const RARITY_TAB_LABELS: Record<RarityBucketId, string> = {
  all: "All",
  base: "Base",
  rare: "Rare",
  ultra: "Ultra Rare",
  secret: "Secret Rare",
};

const BASE_TERMS = [
  "Common",
  "Uncommon",
  /** Vintage reverse slots (Neo / e-Card era, etc.) */
  "Common Reverse Holo",
  "Uncommon Reverse Holo",
] as const;

const RARE_TERMS = [
  /** Plain rare — must exclude "Rare Holo…" because Lucene treats rarity:Rare as matching both */
  "Rare",
  "Rare Holo",
  "Rare Holo EX",
  "Rare Holo Cosmos",
  "Rare Prime",
  "Rare BREAK",
  "Rare ACE",
  "Rare Shining",
  "Rare Shining Neo",
  "Rare Reverse Holo",
  /** Standalone print-type labels in cache */
  "Reverse Holo",
  "Trainer Gallery Rare Holo",
  "Promo",
] as const;

const ULTRA_TERMS = [
  "Rare Ultra",
  "Ultra Rare",
  "Double Rare",
  "Illustration Rare",
  "Amazing Rare",
  "Radiant Rare",
  "ACE SPEC Rare",
  "Shiny Rare",
  "Rare Shiny",
  "Rare Holo V",
  "Rare Holo VMAX",
  "Rare Holo VSTAR",
  "Rare Holo LV.X",
  "Rare Holo Star",
  "Rare Holo Lv.X",
  "Rare Prism Star",
  "Rare GX",
  "Rare Holo GX",
  "Rare TAG TEAM",
  "LEGEND",
  "Shiny Ultra Rare",
  "MEGA_ATTACK_RARE",
  "Black White Rare",
] as const;

const SECRET_TERMS = [
  "Secret Rare",
  "Hyper Rare",
  "Mega Hyper Rare",
  "Special Illustration Rare",
  "Rare Secret",
  "Rare Rainbow",
  "Rare Shiny GX",
  "Rare Secret GX",
  "Classic Collection",
] as const;

const BUCKET_TERMS: Record<Exclude<RarityBucketId, "all">, readonly string[]> = {
  base: BASE_TERMS,
  rare: RARE_TERMS,
  ultra: ULTRA_TERMS,
  secret: SECRET_TERMS,
};

function luceneQuotedRarity(term: string): string {
  const t = term.trim();
  if (!t) return "";
  const escaped = t.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `rarity:"${escaped}"`;
}

/**
 * Pokémon TCG API Lucene matches `rarity:Rare` against both "Rare" and "Rare Holo".
 * Restrict plain Rare to non-holo prints.
 */
function luceneRarityClause(term: string): string {
  const t = term.trim();
  if (!t) return "";
  if (t === "Rare") {
    return `(rarity:Rare AND -rarity:"Rare Holo")`;
  }
  return /\s/.test(t) ? luceneQuotedRarity(t) : `rarity:${t}`;
}

function rarityOrGroup(terms: readonly string[]): string {
  return terms.map(luceneRarityClause).filter(Boolean).join(" OR ");
}

export function buildSetCardsQuery(setId: string, bucket: RarityBucketId): string {
  const sid = setId.trim();
  if (!sid) throw new Error("setId required");
  if (bucket === "all") return `set.id:${sid}`;
  const inner = rarityOrGroup(BUCKET_TERMS[bucket]);
  if (!inner) return `set.id:${sid}`;
  return `set.id:${sid} AND (${inner})`;
}

function normalizeRarityLabel(rarity: string): string {
  return rarity.trim().replace(/\s+/g, " ");
}

/** True when a catalog/API rarity string belongs to a browse tab term. */
export function rarityMatchesTerm(rarity: string, term: string): boolean {
  const r = normalizeRarityLabel(rarity);
  const t = normalizeRarityLabel(term);
  if (!r || !t) return false;
  if (t === "Rare") return r === "Rare";
  return r.localeCompare(t, undefined, { sensitivity: "accent" }) === 0;
}

/** Map official rarity text → browse tab (null = only visible under All). */
export function inferRarityBucket(
  rarity: string | null | undefined,
): Exclude<RarityBucketId, "all"> | null {
  if (!rarity?.trim()) return null;
  const order: Exclude<RarityBucketId, "all">[] = ["secret", "ultra", "rare", "base"];
  for (const bucket of order) {
    for (const term of BUCKET_TERMS[bucket]) {
      if (rarityMatchesTerm(rarity, term)) return bucket;
    }
  }
  return null;
}

export function cardMatchesRarityBucket(
  rarity: string | null | undefined,
  bucket: RarityBucketId,
): boolean {
  if (bucket === "all") return true;
  return inferRarityBucket(rarity) === bucket;
}

export function emptyRarityCounts(): Record<RarityBucketId, number> {
  return { all: 0, base: 0, rare: 0, ultra: 0, secret: 0 };
}

/** Count cards per tab from in-memory rows (Supabase cache path). */
export function countCardsByRarityBucket(
  cards: ReadonlyArray<{ rarity?: string | null }>,
): Record<RarityBucketId, number> {
  const counts = emptyRarityCounts();
  counts.all = cards.length;
  for (const card of cards) {
    const bucket = inferRarityBucket(card.rarity ?? null);
    if (bucket) counts[bucket] += 1;
  }
  return counts;
}
