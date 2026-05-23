import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import {
  buildCatalogMatch,
  buildCatalogSearchText,
  scoreNameSetNumber,
} from "@/lib/market/catalog-match-utils";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { effectiveCatalogSearchName } from "@/lib/scan/card-display";
import type { CardFranchise } from "@/lib/scan/franchise";
import type { ExtractedCard, IdentityEvidence } from "@/lib/scan/schemas";

type DbCatalogRow = {
  catalog_id: string;
  name: string;
  printed_name: string | null;
  set_name: string | null;
  set_code: string | null;
  card_number: string | null;
  year: string | null;
  rarity: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  prices_json: Record<string, unknown> | null;
};

export async function searchDbCatalog(
  card: ExtractedCard,
  franchise: CardFranchise,
): Promise<CatalogMatch | null> {
  if (!isSupabaseConfigured()) return null;
  const name = effectiveCatalogSearchName(card);
  if (!name) return null;

  const supabase = getSupabaseAdmin();
  const searchBlob = buildCatalogSearchText([
    name,
    card.printedName,
    card.set,
    card.number,
    card.year,
  ]);

  let query = supabase
    .from("tcg_catalog_cards")
    .select(
      "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json",
    )
    .eq("franchise", franchise)
    .limit(24);

  if (card.number?.trim()) {
    query = query.ilike("card_number", `%${card.number.trim().replace(/[%_]/g, "")}%`);
  } else {
    query = query.ilike("name", `%${name.slice(0, 48).replace(/[%_]/g, "")}%`);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    const fallback = await supabase
      .from("tcg_catalog_cards")
      .select(
        "catalog_id,name,printed_name,set_name,set_code,card_number,year,rarity,image_small_url,image_large_url,prices_json",
      )
      .eq("franchise", franchise)
      .textSearch("search_text", searchBlob.split(" ").filter((t) => t.length > 2).slice(0, 4).join(" & "), {
        type: "websearch",
      })
      .limit(16);
    if (fallback.error || !fallback.data?.length) return null;
    return rowsToMatch(card, franchise, fallback.data as DbCatalogRow[], searchBlob);
  }

  return rowsToMatch(card, franchise, data as DbCatalogRow[], searchBlob);
}

function rowsToMatch(
  card: ExtractedCard,
  franchise: CardFranchise,
  rows: DbCatalogRow[],
  searchBlob: string,
): CatalogMatch | null {
  const scored = rows.map((row) => {
    const hitName = row.printed_name?.trim() || row.name;
    const result = scoreNameSetNumber(card, {
      name: hitName,
      setName: row.set_name,
      cardNumber: row.card_number,
      year: row.year,
    });
    const prices = (row.prices_json ?? {}) as {
      tcgPlayerUrl?: string | null;
    };
    return {
      catalogId: row.catalog_id,
      name: hitName,
      setName: row.set_name,
      cardNumber: row.card_number,
      year: row.year,
      rarity: row.rarity,
      score: result.score + (buildCatalogSearchText([hitName, row.set_name, row.card_number]) === searchBlob ? 5 : 0),
      confidence: result.score / 100,
      reasons: [...result.reasons, "db_cache"],
      conflicts: result.conflicts,
      imageSmallUrl: row.image_small_url,
      imageLargeUrl: row.image_large_url,
      prices: {
        tcgPlayerUrl: prices.tcgPlayerUrl ?? null,
        tcgPlayerUpdatedAt: null,
        tcgPlayerPrices: [],
        cardMarketUrl: null,
        cardMarketUpdatedAt: null,
        cardMarket: null,
      },
    };
  });

  const evidence: IdentityEvidence[] = [
    {
      field: "catalog",
      extracted: searchBlob,
      catalog: `Supabase tcg_catalog_cards (${franchise})`,
      status: "info",
      weight: 70,
      reason: "Matched cached catalog row synced from official API.",
    },
  ];

  return buildCatalogMatch(scored, evidence, "strict");
}

export type CatalogCardUpsert = {
  franchise: CardFranchise | "sports";
  catalogId: string;
  name: string;
  printedName?: string | null;
  setName?: string | null;
  setCode?: string | null;
  cardNumber?: string | null;
  year?: string | null;
  rarity?: string | null;
  imageSmallUrl?: string | null;
  imageLargeUrl?: string | null;
  pricesJson?: Record<string, unknown>;
  rawJson?: Record<string, unknown>;
  sourceId: string;
};

export async function upsertCatalogCards(rows: CatalogCardUpsert[]): Promise<number> {
  if (!isSupabaseConfigured() || rows.length === 0) return 0;
  const supabase = getSupabaseAdmin();
  const payload = rows.map((row) => ({
    franchise: row.franchise,
    catalog_id: row.catalogId,
    name: row.name,
    printed_name: row.printedName ?? null,
    set_name: row.setName ?? null,
    set_code: row.setCode ?? null,
    card_number: row.cardNumber ?? null,
    year: row.year ?? null,
    rarity: row.rarity ?? null,
    image_small_url: row.imageSmallUrl ?? null,
    image_large_url: row.imageLargeUrl ?? null,
    search_text: buildCatalogSearchText([
      row.name,
      row.printedName,
      row.setName,
      row.setCode,
      row.cardNumber,
      row.year,
      row.rarity,
    ]),
    prices_json: row.pricesJson ?? {},
    raw_json: row.rawJson ?? {},
    source_id: row.sourceId,
    synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("tcg_catalog_cards").upsert(payload, {
    onConflict: "franchise,catalog_id",
  });
  if (error) throw new Error(error.message);
  return payload.length;
}

export async function touchCatalogSourceSync(sourceId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  await supabase
    .from("tcg_catalog_sources")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", sourceId);
}
