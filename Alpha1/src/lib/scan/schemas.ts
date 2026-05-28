import { z } from "zod";

export const verificationFieldStatusSchema = z.enum([
  "verified",
  "mismatch",
  "unverified",
]);

export const verificationFieldSchema = z.object({
  field: z.string(),
  extracted: z.string().nullable(),
  verified: z.string().nullable(),
  status: verificationFieldStatusSchema,
});

export const marketEvidenceSchema = z.object({
  kind: z.enum(["sold", "active", "reference"]),
  title: z.string(),
  priceUsd: z.number().nullable(),
  observedAt: z.string().nullable(),
  url: z.string().url().nullable(),
  source: z.string().nullable().optional(),
  slab: z.string().nullable().optional(),
  gradeBucket: z
    .enum([
      "raw",
      "psa9",
      "psa10",
      "bgs10",
      "bgsBlackLabel",
      "cgc10",
      "cgcPristine10",
      "tag10",
      "gradedOther",
      "unknown",
    ])
    .optional(),
  saleType: z.enum(["auction", "buy_now", "offer", "unknown"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const marketSourceLinkSchema = z.object({
  source: z.enum([
    "ebay",
    "cardladder",
    "alt",
    "goldin",
    "fanatics",
    "pricecharting",
    "cardmarket",
    "tcgplayer",
  ]),
  label: z.string(),
  lane: z.enum(["sold", "active"]),
  url: z.string().url(),
});

export const catalogIdentityStatusSchema = z.enum([
  "confirmed",
  "likely",
  "ambiguous",
  "failed",
]);

export const japanesePokemonMatchMethodSchema = z.enum([
  "exact_japanese_name_number",
  "set_number_match",
  "artwork_similarity",
  "known_counterpart_mapping",
  "translation_fallback",
  "low_confidence_manual_review",
]);

export const japanesePokemonMatchStatusSchema = z.enum([
  "confirmed",
  "needs_soft_review",
  "needs_manual_review",
]);

export const identityEvidenceSchema = z.object({
  field: z.string(),
  extracted: z.string().nullable(),
  catalog: z.string().nullable(),
  status: z.enum(["match", "conflict", "missing", "info"]),
  weight: z.number(),
  reason: z.string(),
});

export const catalogCandidateSchema = z.object({
  catalogId: z.string(),
  name: z.string(),
  setName: z.string().nullable(),
  cardNumber: z.string().nullable(),
  year: z.string().nullable(),
  rarity: z.string().nullable(),
  score: z.number(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  conflicts: z.array(z.string()),
  imageSmallUrl: z.string().url().nullable(),
  imageLargeUrl: z.string().url().nullable(),
});

export const scanCardContextSchema = z.object({
  specimenId: z.string(),
  catalogId: z.string().nullable(),
  catalogIdentityStatus: catalogIdentityStatusSchema,
  catalogConfidence: z.number().min(0).max(1),
  catalogCandidates: z.array(catalogCandidateSchema),
  identityEvidence: z.array(identityEvidenceSchema),
  name: z.string(),
  setName: z.string().nullable(),
  cardNumber: z.string().nullable(),
  year: z.string().nullable(),
  variantLabel: z.string().nullable(),
  encapsulation: z.enum(["raw", "graded_slab"]),
  lane: z.enum(["raw", "graded"]),
  fairValueUsd: z.number().nullable(),
  fairValueBasis: z
    .enum([
      "sold_median",
      "active_median",
      "reference_median",
      "sticker_anchor",
      "tcg_catalog",
      "target_sold_median",
      "target_active_median",
      "target_reference_median",
      "nearest_sold_median",
    ])
    .nullable()
    .optional(),
  anchorUsd: z.number().nullable(),
  askingUsd: z.number().nullable(),
  marketAsOf: z.string(),
  verificationStatus: z.enum(["verified", "partial", "failed"]),
  confidence: z.number().min(0).max(1),
  blockers: z.array(z.string()),
  verificationFields: z.array(verificationFieldSchema),
  marketEvidence: z.array(marketEvidenceSchema),
  marketSourceLinks: z.array(marketSourceLinkSchema),
  populationSummary: z.string().nullable(),
  ebaySoldSearchUrl: z.string().url().nullable(),
  ebayActiveSearchUrl: z.string().url().nullable(),
  registryUrl: z.string().url().nullable(),
  extraction: z.record(z.string(), z.unknown()),
  /** Official Pokémon TCG API small art when catalog match succeeds (enrich / resolver). */
  catalogImageUrl: z.string().nullable().optional(),
  /** Image source for localized/fallback catalog artwork. */
  catalogImageSource: z
    .enum([
      "exact_japanese_print",
      "same_art_confirmed",
      "english_fallback",
      "needs_image_review",
    ])
    .nullable()
    .optional(),
  catalogImageSourceLabel: z.string().nullable().optional(),
  catalogImageNeedsReview: z.boolean().optional(),
  /** Grader cert lookup provider id (gemrate, psa_cert_page, web_snippet, …). */
  certProvider: z.string().nullable().optional(),
  certGradeDate: z.string().nullable().optional(),
  /** Sold/active rows tied to this cert # (eBay / snippet harvest). */
  certMarketEvidence: z.array(marketEvidenceSchema).optional(),
});

export const structuredBriefSchema = z.object({
  summary: z.string(),
  /** Current market read from in-session evidence (no invented comps). */
  marketSnapshot: z.string().optional(),
  /** Synthesis of sold/active/reference rows in context. */
  compAnalysis: z.string().optional(),
  verification: z.array(verificationFieldSchema),
  gradedSupply: z.string().nullable(),
  marketEvidence: z.array(marketEvidenceSchema),
  valuation: z.string(),
  nextChecks: z.array(z.string()),
});

export type VerificationFieldStatus = z.infer<
  typeof verificationFieldStatusSchema
>;
export type VerificationField = z.infer<typeof verificationFieldSchema>;
export type MarketEvidence = z.infer<typeof marketEvidenceSchema>;
export type MarketSourceLink = z.infer<typeof marketSourceLinkSchema>;
export type CatalogIdentityStatus = z.infer<typeof catalogIdentityStatusSchema>;
export type IdentityEvidence = z.infer<typeof identityEvidenceSchema>;
export type CatalogCandidate = z.infer<typeof catalogCandidateSchema>;
export type ScanCardContext = z.infer<typeof scanCardContextSchema>;
export type StructuredBrief = z.infer<typeof structuredBriefSchema>;

export const extractedCardSchema = z.object({
  franchise: z.string().max(80).optional(),
  name: z.string().min(1).max(160),
  printedName: z.string().max(160).optional(),
  language: z.string().max(64).optional(),
  rawDetectedText: z.string().max(2_000).optional(),
  detectedLanguage: z.enum(["Japanese", "English", "Unknown"]).optional(),
  japaneseName: z.string().max(160).optional(),
  englishCounterpartName: z.string().max(160).optional(),
  setNameJapanese: z.string().max(160).optional(),
  setNameEnglish: z.string().max(160).optional(),
  set: z.string().max(160).optional(),
  number: z.string().max(64).optional(),
  englishCounterpartNumber: z.string().max(64).optional(),
  year: z.string().max(16).optional(),
  rarity: z.string().max(80).optional(),
  matchConfidence: z.number().min(0).max(1).optional(),
  matchMethod: japanesePokemonMatchMethodSchema.optional(),
  japaneseMatchStatus: japanesePokemonMatchStatusSchema.optional(),
  grader: z.string().max(32).optional(),
  grade: z.string().max(32).optional(),
  cert: z.string().max(80).optional(),
  details: z.string().max(1_500).optional(),
  /** Visible print / edition stamps (1st Edition, Shadowless, Unlimited, Reverse Holo, promo marks, etc.) */
  printStamps: z.string().max(200).optional(),
  /** Verbatim slab holder label text (top tag); may span multiple lines joined with · */
  labelTitle: z.string().max(400).optional(),
  extractedPrice: z.number().nullable().optional(),
  stickerNote: z.string().nullable().optional(),
  encapsulation: z.string().optional(),
  location: z.tuple([z.number(), z.number()]).optional(),
  bbox: z
    .object({
      top: z.number(),
      left: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  sourceImageIndex: z.number().nullable().optional(),
  visionBatchMerged: z.boolean().optional(),
  visionLane: z.enum(["raw", "graded"]).optional(),
  visionLaneConfidence: z.number().optional(),
  marketLanguage: z.enum(["Japanese", "English", "Unknown"]).optional(),
  pricingConfidence: z.number().min(0).max(1).optional(),
  rawEstimate: z.number().nullable().optional(),
  gradedEstimate: z.number().nullable().optional(),
  fallbackUsed: z.boolean().optional(),
  fallbackReason: z.string().max(300).optional(),
});

export type ExtractedCard = z.infer<typeof extractedCardSchema>;
