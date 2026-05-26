import type { CardMatch } from "@/lib/scanner-chat/types";
import type { ExtractedCard } from "@/lib/scan/schemas";

/** Real capture assets used in dev scans (see empty state + sign-in tour). */
export const ONBOARDING_BINDER_IMAGES = {
  binderPage: {
    src: "/branding/binder-test-1.jpg",
    alt: "Pokémon Fossil binder page — six cards in one photo",
    label: "Binder page · 6 cards",
  },
  gradedSlabs: {
    src: "/branding/binder-test-2.jpg",
    alt: "Graded Pokémon slabs on desk",
    label: "Slabs · PSA & raw",
  },
} as const;

const raichuExtracted: ExtractedCard = {
  franchise: "pokemon",
  name: "Raichu",
  set: "Fossil",
  number: "14/62",
  year: "1999",
  rarity: "Rare",
  grader: "PSA",
  grade: "9",
  cert: "48291034",
  visionLane: "graded",
};

const zapdosExtracted: ExtractedCard = {
  franchise: "pokemon",
  name: "Zapdos",
  set: "Fossil",
  number: "15/62",
  year: "1999",
  rarity: "Holo Rare",
  visionLane: "raw",
};

/** Representative Fossil-page scan results (matches real Liquid Scan output shape). */
export const ONBOARDING_DEMO_CARDS: CardMatch[] = [
  {
    id: "demo-raichu",
    specimenId: "demo-raichu",
    name: "Raichu",
    setName: "Fossil",
    setNumber: "14/62",
    year: "1999",
    rarity: "Rare",
    graded: { company: "PSA", grade: "9", cert: "48291034" },
    confidence: 94,
    fmvUsd: 142,
    fmvDisplay: "$142",
    fmvSubline: "3 sold comps · PSA 9 lane",
    stickerUsd: null,
    stickerDisplay: "—",
    hasSticker: false,
    latestSoldUsd: 148,
    soldCompCount: 3,
    marketLow: 142,
    marketHigh: 142,
    sources: ["eBay sold", "Card Ladder"],
    status: "verified",
    thumbnailGradient: "from-amber-500/40 via-yellow-400/30 to-orange-500/40",
    catalogImageUrl: ONBOARDING_BINDER_IMAGES.binderPage.src,
    previewUrl: ONBOARDING_BINDER_IMAGES.binderPage.src,
    extractedCard: raichuExtracted,
    verificationStatus: "verified",
    catalogIdentityStatus: "matched",
    fairValueUsd: 142,
  },
  {
    id: "demo-zapdos",
    specimenId: "demo-zapdos",
    name: "Zapdos",
    setName: "Fossil",
    setNumber: "15/62",
    year: "1999",
    rarity: "Holo Rare",
    confidence: 91,
    fmvUsd: 186,
    fmvDisplay: "$186",
    fmvSubline: "5 sold comps · raw NM",
    stickerUsd: 200,
    stickerDisplay: "$200",
    hasSticker: true,
    latestSoldUsd: 179,
    soldCompCount: 5,
    marketLow: 186,
    marketHigh: 186,
    sources: ["eBay sold", "TCGPlayer"],
    status: "verified",
    thumbnailGradient: "from-sky-500/40 via-cyan-400/30 to-indigo-600/40",
    catalogImageUrl: ONBOARDING_BINDER_IMAGES.binderPage.src,
    previewUrl: ONBOARDING_BINDER_IMAGES.binderPage.src,
    extractedCard: zapdosExtracted,
    verificationStatus: "verified",
    catalogIdentityStatus: "matched",
    fairValueUsd: 186,
  },
];

export const ONBOARDING_DEMO_SUMMARY = {
  totalDetected: 6,
  highConfidence: 5,
  needsReview: 1,
  estimatedTotal: 847,
  bestHit: { name: "Zapdos", fmv: 186 },
} as const;

export const ONBOARDING_MARKET_TIERS = [
  { label: "PSA 10", value: "$380", highlight: false },
  { label: "PSA 9", value: "$142", highlight: true },
  { label: "Raw NM", value: "$28", highlight: false },
] as const;

export const ONBOARDING_SOLD_ROWS = [
  { title: "Raichu Fossil Rare 1999 PSA 9", price: "$148", when: "Apr 12" },
  { title: "Raichu Fossil #14 PSA 9", price: "$139", when: "Mar 28" },
  { title: "Raichu Fossil PSA 9", price: "$145", when: "Mar 3" },
] as const;
