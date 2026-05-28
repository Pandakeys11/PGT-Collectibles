import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import {
  resolveTcgDexAliases,
  tcgDexImageUrls,
} from "@/lib/market/tcgdex-client";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { isJapanesePokemonCard } from "@/lib/scan/japanese-pokemon";
import type { ExtractedCard } from "@/lib/scan/schemas";

export type LocalizedArtworkStatus =
  | "exact_japanese_print"
  | "same_art_confirmed"
  | "english_fallback"
  | "needs_image_review";

export type LocalizedArtworkMatchMethod =
  | "exact_localized_id"
  | "set_number_match"
  | "curated_mapping"
  | "tcgdex_alias"
  | "english_counterpart_fallback"
  | "manual_review";

export type LocalizedArtworkResolution = {
  imageSmallUrl: string | null;
  imageLargeUrl: string | null;
  source: string;
  sourceLabel: string;
  status: LocalizedArtworkStatus;
  matchMethod: LocalizedArtworkMatchMethod;
  matchConfidence: number;
  needsReview: boolean;
  localizedCatalogId?: string | null;
};

type LocalizedArtworkRow = {
  franchise: string;
  base_catalog_id: string;
  language: string;
  localized_catalog_id: string | null;
  localized_set_code: string | null;
  localized_set_name: string | null;
  localized_name: string | null;
  printed_number: string | null;
  counterpart_number: string | null;
  image_small_url: string | null;
  image_large_url: string | null;
  artwork_match_status: LocalizedArtworkStatus;
  match_method: LocalizedArtworkMatchMethod;
  match_confidence: number | string | null;
  source: string;
  source_payload: Record<string, unknown> | null;
};

export type LocalizedArtworkUpsert = {
  franchise: string;
  baseCatalogId: string;
  language: string;
  localizedCatalogId?: string | null;
  localizedSetCode?: string | null;
  localizedSetName?: string | null;
  localizedName?: string | null;
  printedNumber?: string | null;
  counterpartNumber?: string | null;
  imageSmallUrl?: string | null;
  imageLargeUrl?: string | null;
  artworkMatchStatus: LocalizedArtworkStatus;
  matchMethod: LocalizedArtworkMatchMethod;
  matchConfidence: number;
  source: string;
  sourcePayload?: Record<string, unknown>;
};

function normalizeText(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numberHead(value: string | undefined | null): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const no = raw.match(/\bNo\.?\s*0*(\d{1,3})\b/i);
  if (no?.[1]) return no[1].padStart(3, "0");
  const fraction = raw.match(/\b0*(\d{1,3})(?:\s*\/\s*\d{1,3})?\b/);
  return fraction?.[1] ? fraction[1].padStart(3, "0") : null;
}

function isOldBackPrintedNo(card: ExtractedCard): boolean {
  return /^\s*No\.?\s*\d{1,3}\s*$/i.test(card.number ?? "");
}

function catalogIdFor(catalog: CatalogMatch | null): string | null {
  return (
    catalog?.catalogId?.trim() ||
    catalog?.candidates?.[0]?.catalogId?.trim() ||
    null
  );
}

function catalogNameFor(catalog: CatalogMatch | null): string | null {
  return catalog?.name?.trim() || catalog?.candidates?.[0]?.name?.trim() || null;
}

function catalogSetFor(catalog: CatalogMatch | null): string | null {
  return catalog?.setName?.trim() || catalog?.candidates?.[0]?.setName?.trim() || null;
}

function rowToResolution(row: LocalizedArtworkRow): LocalizedArtworkResolution {
  const confidence =
    typeof row.match_confidence === "number"
      ? row.match_confidence
      : Number(row.match_confidence ?? 0);
  const imageSmallUrl = row.image_small_url?.trim() || null;
  const imageLargeUrl = row.image_large_url?.trim() || imageSmallUrl;
  return {
    imageSmallUrl,
    imageLargeUrl,
    source: row.source,
    sourceLabel:
      row.artwork_match_status === "exact_japanese_print"
        ? "Japanese Art"
        : row.artwork_match_status === "same_art_confirmed"
          ? "Japanese Art"
          : row.artwork_match_status === "english_fallback"
            ? "English Art Fallback"
            : "Needs Image Review",
    status: row.artwork_match_status,
    matchMethod: row.match_method,
    matchConfidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    needsReview: row.artwork_match_status === "needs_image_review" || confidence < 0.85,
    localizedCatalogId: row.localized_catalog_id,
  };
}

async function lookupOverlayRow(args: {
  catalogId: string;
  printedNumber: string | null;
}): Promise<LocalizedArtworkResolution | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();

  try {
    const query = supabase
      .from("tcg_catalog_localized_artwork")
      .select(
        "franchise,base_catalog_id,language,localized_catalog_id,localized_set_code,localized_set_name,localized_name,printed_number,counterpart_number,image_small_url,image_large_url,artwork_match_status,match_method,match_confidence,source,source_payload",
      )
      .eq("franchise", "pokemon")
      .eq("base_catalog_id", args.catalogId)
      .ilike("language", "Japanese")
      .order("match_confidence", { ascending: false })
      .limit(12);

    const { data, error } = await query;
    if (error || !data?.length) return null;
    const rows = data as LocalizedArtworkRow[];
    const printed = args.printedNumber;
    const exact =
      printed != null
        ? rows.find((row) => numberHead(row.printed_number) === printed)
        : null;
    return rowToResolution(exact ?? rows[0]!);
  } catch {
    // Table may not be applied yet in local/dev; fail open to the existing catalog art.
    return null;
  }
}

function tcgDexResolutionFromBase(args: {
  imageBase: string;
  localizedCatalogId: string;
  confidence: number;
}): LocalizedArtworkResolution {
  const urls = args.imageBase.includes("assets.tcgdex.net") && !/\.(png|webp|jpe?g)$/i.test(args.imageBase)
    ? tcgDexImageUrls(args.imageBase)
    : { small: args.imageBase, large: args.imageBase };
  return {
    imageSmallUrl: urls.small,
    imageLargeUrl: urls.large,
    source: "tcgdex",
    sourceLabel: "Japanese Art",
    status: "exact_japanese_print",
    matchMethod: "tcgdex_alias",
    matchConfidence: args.confidence,
    needsReview: args.confidence < 0.9,
    localizedCatalogId: args.localizedCatalogId,
  };
}

async function resolveTcgDexJapaneseArtwork(
  card: ExtractedCard,
  catalog: CatalogMatch | null,
): Promise<LocalizedArtworkResolution | null> {
  // Old-back Japanese No.### is usually a Pokedex number. Do not use it as a TCGdex local ID.
  if (isOldBackPrintedNo(card)) return null;

  const expectedName = normalizeText(card.englishCounterpartName ?? catalogNameFor(catalog));
  const expectedSet = normalizeText(card.setNameEnglish ?? catalogSetFor(catalog));
  const expectedNumber = numberHead(card.englishCounterpartNumber ?? catalog?.cardNumber);
  if (!expectedName) return null;

  const aliases = await resolveTcgDexAliases(card);
  for (const alias of aliases) {
    const nameOk = normalizeText(alias.englishName) === expectedName;
    const setOk = !expectedSet || normalizeText(alias.englishSetName) === expectedSet;
    const numberOk =
      !expectedNumber ||
      !alias.englishNumber ||
      numberHead(alias.englishNumber) === expectedNumber;
    if (!nameOk || !setOk || !numberOk || !alias.imageUrl) continue;
    return tcgDexResolutionFromBase({
      imageBase: alias.imageUrl,
      localizedCatalogId: alias.tcgdexId,
      confidence: setOk && numberOk ? 0.92 : 0.86,
    });
  }
  return null;
}

function englishFallbackResolution(
  fallbackImageUrl: string | null | undefined,
): LocalizedArtworkResolution | null {
  const url = fallbackImageUrl?.trim();
  if (!url) return null;
  return {
    imageSmallUrl: url,
    imageLargeUrl: url,
    source: "pokemon-tcg-api",
    sourceLabel: "English Art Fallback",
    status: "english_fallback",
    matchMethod: "english_counterpart_fallback",
    matchConfidence: 0.7,
    needsReview: false,
  };
}

export async function resolveLocalizedCatalogArtwork(args: {
  card: ExtractedCard;
  catalog: CatalogMatch | null;
  fallbackImageUrl?: string | null;
}): Promise<LocalizedArtworkResolution | null> {
  if (!isJapanesePokemonCard(args.card)) return null;

  const catalogId = catalogIdFor(args.catalog);
  const printedNumber = numberHead(args.card.number);
  if (catalogId) {
    const overlay = await lookupOverlayRow({ catalogId, printedNumber });
    if (overlay?.imageSmallUrl || overlay?.imageLargeUrl || overlay?.needsReview) {
      return overlay;
    }
  }

  const tcgdex = await resolveTcgDexJapaneseArtwork(args.card, args.catalog);
  if (tcgdex) return tcgdex;

  return englishFallbackResolution(args.fallbackImageUrl);
}

export async function upsertLocalizedCatalogArtwork(
  rows: LocalizedArtworkUpsert[],
): Promise<number> {
  if (!isSupabaseConfigured() || rows.length === 0) return 0;
  const supabase = getSupabaseAdmin();
  const payload = rows.map((row) => ({
    franchise: row.franchise,
    base_catalog_id: row.baseCatalogId,
    language: row.language,
    localized_catalog_id: row.localizedCatalogId ?? "",
    localized_set_code: row.localizedSetCode ?? null,
    localized_set_name: row.localizedSetName ?? null,
    localized_name: row.localizedName ?? null,
    printed_number: row.printedNumber ?? "",
    counterpart_number: row.counterpartNumber ?? null,
    image_small_url: row.imageSmallUrl ?? null,
    image_large_url: row.imageLargeUrl ?? null,
    artwork_match_status: row.artworkMatchStatus,
    match_method: row.matchMethod,
    match_confidence: row.matchConfidence,
    source: row.source,
    source_payload: row.sourcePayload ?? {},
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("tcg_catalog_localized_artwork")
    .upsert(payload, {
      onConflict:
        "franchise,base_catalog_id,language,localized_catalog_id,printed_number",
    });
  if (error) throw new Error(error.message);
  return payload.length;
}
