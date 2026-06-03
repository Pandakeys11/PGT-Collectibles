import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { SlabzCard } from "@/lib/slabz/types";

export type SlabzCatalogIdentityRow = {
  catalogId: string;
  franchise: string;
  name: string;
  printedName: string | null;
  setName: string | null;
  cardNumber: string | null;
  year: string | null;
  rarity: string | null;
  imageUrl: string | null;
  slabzCard: SlabzCard | null;
};

export async function loadSlabzCatalogIdentity(
  catalogId: string,
): Promise<SlabzCatalogIdentityRow | null> {
  const id = catalogId.trim();
  if (!id.startsWith("slabz:") || !isSupabaseConfigured()) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("tcg_catalog_cards")
    .select(
      "catalog_id, franchise, name, printed_name, set_name, card_number, year, rarity, image_large_url, image_small_url, raw_json",
    )
    .eq("catalog_id", id)
    .maybeSingle();

  if (error || !data) return null;

  const raw = (data.raw_json ?? {}) as Record<string, unknown>;
  const partnerCard = raw.card as Record<string, unknown> | undefined;
  let slabzCard: SlabzCard | null = null;
  if (partnerCard && typeof partnerCard.name === "string") {
    slabzCard = {
      nftMint: String(partnerCard.nftMint ?? ""),
      name: partnerCard.name,
      rarity: (partnerCard.rarity as SlabzCard["rarity"]) ?? "rare",
      insuredValueCents: Number(partnerCard.insuredValueCents ?? 0),
      imageUrl: String(partnerCard.imageUrl ?? data.image_large_url ?? ""),
      imageBackUrl:
        typeof partnerCard.imageBackUrl === "string" ? partnerCard.imageBackUrl : null,
      grade: typeof partnerCard.grade === "string" ? partnerCard.grade : null,
      gradeNum: typeof partnerCard.gradeNum === "string" ? partnerCard.gradeNum : null,
      gradingCompany:
        typeof partnerCard.gradingCompany === "string" ? partnerCard.gradingCompany : null,
      year: typeof partnerCard.year === "number" ? partnerCard.year : null,
      category: typeof partnerCard.category === "string" ? partnerCard.category : null,
      serialNumber:
        typeof partnerCard.serialNumber === "string" ? partnerCard.serialNumber : null,
    };
  }

  return {
    catalogId: data.catalog_id,
    franchise: data.franchise,
    name: data.name,
    printedName: data.printed_name,
    setName: data.set_name,
    cardNumber: data.card_number,
    year: data.year,
    rarity: data.rarity,
    imageUrl: data.image_large_url ?? data.image_small_url ?? slabzCard?.imageUrl ?? null,
    slabzCard,
  };
}
