import "server-only";

import type { CatalogFranchiseId } from "@/lib/catalog/catalog-types";
import type { CatalogSetUpsert } from "@/lib/catalog/db-catalog-browse";
import { upsertCatalogSets } from "@/lib/catalog/db-catalog-browse";
import type { CatalogCardUpsert } from "@/lib/catalog/db-catalog";
import { upsertCatalogCards, touchCatalogSourceSync } from "@/lib/catalog/db-catalog";
import { isSlabzPartnerConfigured } from "@/lib/slabz/config";
import { catalogIdForSlabzCard, catalogIdForSlabzPack } from "@/lib/slabz/catalog-id";
import { normalizeSlabzPack, resolveSlabzPackImageUrl, slabzPackFranchise } from "@/lib/slabz/pack-art";
import { slabzPartnerFetch, slabzPartnerFetchEnvelope } from "@/lib/slabz/client";
import type {
  SlabzCard,
  SlabzCatalogSyncResult,
  SlabzPack,
  SlabzTransaction,
} from "@/lib/slabz/types";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export const SLABZ_CATALOG_SOURCE_ID = "slabz.com";

function franchiseForSlabzCard(card: SlabzCard, pack?: SlabzPack | null): CatalogFranchiseId {
  if (pack) return slabzPackFranchise(pack);
  const cat = (card.category ?? "").toLowerCase();
  if (cat.includes("one piece") || cat.includes("onepiece")) return "onepiece";
  if (cat.includes("pokemon") || cat.includes("pokémon")) return "pokemon";
  return "sports";
}

function packToCatalogUpsert(pack: SlabzPack): CatalogCardUpsert {
  const franchise = slabzPackFranchise(pack);
  const imageUrl = resolveSlabzPackImageUrl(pack);
  return {
    franchise,
    catalogId: catalogIdForSlabzPack(pack.id),
    name: pack.name,
    printedName: pack.name,
    setName: "Slabz mystery packs",
    setCode: `slabz-${pack.id.slice(0, 8)}`,
    imageSmallUrl: imageUrl,
    imageLargeUrl: imageUrl,
    pricesJson: {
      slabzPriceCents: pack.priceCents,
      source: SLABZ_CATALOG_SOURCE_ID,
    },
    rawJson: {
      partner: "slabz",
      kind: "pack",
      packId: pack.id,
      ccPackType: pack.ccPackType ?? null,
      priceCents: pack.priceCents,
      imageUrl,
      ripGifUrl: imageUrl,
    },
    sourceId: SLABZ_CATALOG_SOURCE_ID,
  };
}

export async function syncSlabzPacksToMasterCatalog(packs: SlabzPack[]): Promise<number> {
  if (!packs.length || !isSupabaseConfigured()) return 0;

  const setRows: CatalogSetUpsert[] = packs.map((pack) => {
    const franchise = slabzPackFranchise(pack);
    const imageUrl = resolveSlabzPackImageUrl(pack);
    return {
      franchise,
      externalSetId: `slabz-pack-${pack.id}`,
      name: `Slabz · ${pack.name}`,
      code: `slabz-${pack.id.slice(0, 8)}`,
      cardCount: null,
      sourceId: SLABZ_CATALOG_SOURCE_ID,
      rawJson: {
        partner: "slabz",
        packId: pack.id,
        priceCents: pack.priceCents,
        ccPackType: pack.ccPackType,
        isActive: pack.isActive,
        imageUrl,
        ripGifUrl: imageUrl,
      },
    };
  });

  let n = 0;
  if (setRows.length > 0) n += await upsertCatalogSets(setRows);

  const packCards = packs.map(packToCatalogUpsert);
  if (packCards.length > 0) n += await upsertCatalogCards(packCards);

  return n;
}

function displayName(card: SlabzCard): string {
  const parts = [card.name?.trim(), card.gradingCompany, card.grade].filter(Boolean);
  if (parts.length >= 2) return parts.join(" ");
  return card.name?.trim() || "Graded slab";
}

function cardToUpsert(
  card: SlabzCard,
  tx: SlabzTransaction,
  pack: SlabzPack | null,
): CatalogCardUpsert {
  const franchise = franchiseForSlabzCard(card, pack);
  const catalogId = catalogIdForSlabzCard(card, tx.transactionId);
  const fmvUsd = card.insuredValueCents != null ? card.insuredValueCents / 100 : null;

  return {
    franchise,
    catalogId,
    name: displayName(card),
    printedName: card.name ?? null,
    setName: pack?.name ?? "Slabz mystery packs",
    setCode: pack ? `slabz-${pack.id.slice(0, 8)}` : "slabz",
    cardNumber: card.serialNumber ?? null,
    year: card.year != null ? String(card.year) : null,
    rarity: card.rarity ?? null,
    imageSmallUrl: card.imageUrl ?? null,
    imageLargeUrl: card.imageUrl ?? card.imageBackUrl ?? null,
    pricesJson: {
      slabzInsuredValueCents: card.insuredValueCents,
      fmvUsd,
      source: SLABZ_CATALOG_SOURCE_ID,
    },
    rawJson: {
      partner: "slabz",
      nftMint: card.nftMint,
      slabzTransactionId: tx.transactionId,
      packId: tx.packId ?? pack?.id,
      grade: card.grade,
      gradeNum: card.gradeNum,
      gradingCompany: card.gradingCompany,
      imageBackUrl: card.imageBackUrl,
      category: card.category,
      serialNumber: card.serialNumber,
    },
    sourceId: SLABZ_CATALOG_SOURCE_ID,
  };
}

async function fetchAllPacks(): Promise<SlabzPack[]> {
  const { data } = await slabzPartnerFetch<SlabzPack[] | { packs?: SlabzPack[] }>("/packs");
  const raw = Array.isArray(data) ? data : (data.packs ?? []);
  return raw.map((p) => normalizeSlabzPack(p as unknown as Record<string, unknown>));
}

async function fetchTransactionsPage(cursor?: string): Promise<{
  transactions: SlabzTransaction[];
  cursor: string | null;
  hasMore: boolean;
}> {
  const qs = new URLSearchParams();
  if (cursor) qs.set("cursor", cursor);
  const path = qs.toString() ? `/transactions?${qs}` : "/transactions";
  const { body } = await slabzPartnerFetchEnvelope(path);
  const data = body.data;
  return {
    transactions: Array.isArray(data) ? (data as SlabzTransaction[]) : [],
    cursor: typeof body.cursor === "string" ? body.cursor : null,
    hasMore: Boolean(body.hasMore),
  };
}

async function upsertSlabzAssetRows(
  card: SlabzCard,
  tx: SlabzTransaction,
  pack: SlabzPack | null,
): Promise<boolean> {
  if (!isSupabaseConfigured() || !card.nftMint) return false;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pgt_slabz_assets").upsert(
    {
      nft_mint: card.nftMint,
      slabz_transaction_id: tx.transactionId,
      pack_id: tx.packId ?? pack?.id ?? null,
      name: displayName(card),
      category: card.category ?? null,
      grade: card.grade ?? null,
      grading_company: card.gradingCompany ?? null,
      serial_number: card.serialNumber ?? null,
      insured_value_cents: card.insuredValueCents ?? null,
      image_front_url: card.imageUrl ?? null,
      image_back_url: card.imageBackUrl ?? null,
      catalog_id: catalogIdForSlabzCard(card, tx.transactionId),
      raw_json: { card, transaction: tx, pack },
      synced_at: new Date().toISOString(),
    },
    { onConflict: "nft_mint" },
  );
  if (error) {
    const msg = (error.message ?? "").toLowerCase();
    if (error.code === "42P01" || msg.includes("pgt_slabz_assets")) return false;
    throw error;
  }
  return true;
}

export async function syncSlabzTransactionToCatalog(
  tx: SlabzTransaction,
  pack?: SlabzPack | null,
): Promise<number> {
  if (tx.status !== "completed" || !tx.card) return 0;
  const rows = [cardToUpsert(tx.card, tx, pack ?? null)];
  let n = await upsertCatalogCards(rows);
  try {
    if (await upsertSlabzAssetRows(tx.card, tx, pack ?? null)) n += 0;
  } catch {
    /* asset table optional until migration */
  }
  return n;
}

export async function syncSlabzToMasterCatalog(options?: {
  maxTransactions?: number;
  includeTransactions?: boolean;
}): Promise<SlabzCatalogSyncResult> {
  const maxTransactions = options?.maxTransactions ?? 500;
  const includeTransactions = options?.includeTransactions !== false;
  const errors: string[] = [];
  const syncedAt = new Date().toISOString();

  if (!isSlabzPartnerConfigured()) {
    return {
      ok: false,
      packsUpserted: 0,
      setsUpserted: 0,
      cardsUpserted: 0,
      transactionsScanned: 0,
      assetRowsUpserted: 0,
      errors: ["SLABZ_API_KEY is not configured"],
      syncedAt,
    };
  }

  let packsUpserted = 0;
  let setsUpserted = 0;
  let cardsUpserted = 0;
  let transactionsScanned = 0;
  let assetRowsUpserted = 0;

  try {
    const packs = await fetchAllPacks();
    packsUpserted = packs.length;

    const packById = new Map(packs.map((p) => [p.id, p]));
    setsUpserted = await syncSlabzPacksToMasterCatalog(packs);
    packsUpserted = packs.length;

    if (includeTransactions) {
      const cardUpserts: CatalogCardUpsert[] = [];
      let cursor: string | undefined;
      let hasMore = true;

      while (hasMore && transactionsScanned < maxTransactions) {
        const page = await fetchTransactionsPage(cursor);
        for (const tx of page.transactions) {
          if (transactionsScanned >= maxTransactions) break;
          transactionsScanned += 1;
          if (tx.status !== "completed" || !tx.card) continue;
          const pack = tx.packId ? (packById.get(tx.packId) ?? null) : null;
          cardUpserts.push(cardToUpsert(tx.card, tx, pack));
          try {
            if (await upsertSlabzAssetRows(tx.card, tx, pack)) assetRowsUpserted += 1;
          } catch (err) {
            errors.push(err instanceof Error ? err.message : "Asset upsert failed");
          }
        }
        if (cardUpserts.length >= 40) {
          cardsUpserted += await upsertCatalogCards(cardUpserts.splice(0, cardUpserts.length));
        }
        cursor = page.cursor ?? undefined;
        hasMore = page.hasMore && Boolean(cursor);
      }

      if (cardUpserts.length > 0) {
        cardsUpserted += await upsertCatalogCards(cardUpserts);
      }
    }

    await touchCatalogSourceSync(SLABZ_CATALOG_SOURCE_ID);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Slabz catalog sync failed");
  }

  return {
    ok: errors.length === 0,
    packsUpserted,
    setsUpserted,
    cardsUpserted,
    transactionsScanned,
    assetRowsUpserted,
    errors,
    syncedAt,
  };
}

export async function countSlabzCatalogAssets(): Promise<{
  catalogCards: number | null;
  assetRows: number | null;
}> {
  if (!isSupabaseConfigured()) return { catalogCards: null, assetRows: null };
  const supabase = getSupabaseAdmin();

  const { count: catalogCount, error: cErr } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id", { count: "exact", head: true })
    .eq("source_id", SLABZ_CATALOG_SOURCE_ID);

  const { count: assetCount, error: aErr } = await supabase
    .from("pgt_slabz_assets")
    .select("nft_mint", { count: "exact", head: true });

  return {
    catalogCards: cErr ? null : (catalogCount ?? 0),
    assetRows: aErr ? null : (assetCount ?? 0),
  };
}
