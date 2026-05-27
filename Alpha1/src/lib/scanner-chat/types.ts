export type ScanMode =
  | "fast"
  | "deep"
  | "market"
  | "graded"
  | "binder";

export type MatchStatus = "verified" | "review" | "ambiguous";

export type ChatMessageRole = "user" | "assistant" | "system";

export type SystemScanStep =
  | "preprocess"
  | "detect"
  | "match"
  | "set-year"
  | "market"
  | "finalize";

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
}

export interface CardMatch {
  id: string;
  specimenId: string;
  name: string;
  setName: string;
  setNumber: string;
  year: string;
  rarity: string;
  /** Resolved edition / parallel / finish (1st Edition, Reverse Holo, Prizm, etc.). */
  printVersion?: string;
  /** Promo-specific stamp when separated from printVersion. */
  printPromo?: string;
  condition?: string;
  graded?: { company: string; grade: string; cert?: string };
  confidence: number;
  /** Market-derived FMV (sold comps / guide) — not the slab sticker. */
  fmvUsd: number | null;
  fmvDisplay: string;
  fmvSubline: string | null;
  /** Sticker or handwritten ask on the card/slab photo. */
  stickerUsd: number | null;
  stickerDisplay: string;
  hasSticker: boolean;
  latestSoldUsd: number | null;
  soldCompCount: number;
  /** @deprecated Use fmvUsd — kept for legacy mocks. */
  marketLow: number;
  /** @deprecated Use fmvUsd — kept for legacy mocks. */
  marketHigh: number;
  sources: string[];
  status: MatchStatus;
  thumbnailGradient: string;
  catalogImageUrl?: string | null;
  previewUrl?: string | null;
  /** Legacy extraction row — powers catalog thumb + future row actions. */
  extractedCard?: import("@/lib/scan/schemas").ExtractedCard;
  verificationStatus?: string;
  catalogIdentityStatus?: string;
  fairValueUsd?: number | null;
}

export interface ScanSummary {
  totalDetected: number;
  highConfidence: number;
  needsReview: number;
  /** Sum of per-card FMV (not min–max spread). */
  estimatedTotal: number;
  bestHit?: { name: string; fmv: number };
}

export interface ChatMessageBase {
  id: string;
  role: ChatMessageRole;
  createdAt: number;
}

export interface UserChatMessage extends ChatMessageBase {
  role: "user";
  text?: string;
  images?: UploadedImage[];
  scanMode?: ScanMode;
}

/** Embedded workspace panels rendered inside the Liquid Scan chat feed. */
export type ChatOutputKind = "catalog" | "companion" | "calculator";

export type ChatOutputPanel = {
  kind: ChatOutputKind;
};

export interface AssistantChatMessage extends ChatMessageBase {
  role: "assistant";
  text: string;
  cards?: CardMatch[];
  summary?: ScanSummary;
  streaming?: boolean;
  /** Inline catalog browser, companion, etc. */
  output?: ChatOutputPanel;
  /** Structured live research from Liquid Vault Ask. */
  askResearch?: import("@/lib/scanner-chat/liquid-ask-types").LiquidAskResearch | null;
  askProvider?: string;
  /** Live status while research / answer streams (ChatGPT-style). */
  askStatus?: string | null;
  /** Post-scan session intelligence article (streams after pipeline completes). */
  scanReport?: boolean;
}

export interface SystemChatMessage extends ChatMessageBase {
  role: "system";
  step: SystemScanStep;
  label: string;
  active?: boolean;
  done?: boolean;
}

export type ChatMessage = UserChatMessage | AssistantChatMessage | SystemChatMessage;

export interface ScanHistoryItem {
  id: string;
  title: string;
  cardCount: number;
  timestamp: number;
}
