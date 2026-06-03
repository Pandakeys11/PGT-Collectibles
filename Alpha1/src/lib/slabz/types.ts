export type SlabzRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type SlabzTransactionStatus =
  | "created"
  | "confirmed"
  | "opening"
  | "completed"
  | "failed"
  | string;

export type SlabzPack = {
  id: string;
  name: string;
  description?: string | null;
  priceCents: number;
  imageUrl?: string | null;
  category?: string | null;
  available?: boolean;
  ccPackType?: string | null;
  isActive?: boolean;
};

export type SlabzTransactionsPage = {
  transactions: SlabzTransaction[];
  cursor: string | null;
  hasMore: boolean;
};

export type SlabzCatalogSyncResult = {
  ok: boolean;
  packsUpserted: number;
  setsUpserted: number;
  cardsUpserted: number;
  transactionsScanned: number;
  assetRowsUpserted: number;
  errors: string[];
  syncedAt: string;
};

export type SlabzCard = {
  nftMint: string;
  name: string;
  rarity: SlabzRarity | string;
  insuredValueCents: number;
  imageUrl: string;
  imageBackUrl?: string | null;
  grade?: string | null;
  gradeNum?: string | null;
  gradingCompany?: string | null;
  year?: number | null;
  category?: string | null;
  serialNumber?: string | null;
};

export type SlabzTransaction = {
  transactionId: string;
  status: SlabzTransactionStatus;
  packId?: string;
  walletAddress?: string;
  priceCents?: number;
  purchaseSignature?: string | null;
  openSignature?: string | null;
  card?: SlabzCard | null;
  retryAfterMs?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SlabzBuybackQuote = {
  offerCents?: number;
  expiresAt?: string | null;
};

export type SlabzPartnerCapabilities = {
  configured: boolean;
  network: "devnet" | "mainnet";
  apiBaseUrl: string;
  docsUrl: string;
};

export type SlabzUserProfile = {
  walletAddress: string | null;
  network: "devnet" | "mainnet";
  storage: "database" | "local";
  /** True when wallet is persisted on the Clerk-linked app_users row. */
  linkedToAccount?: boolean;
};

export type SlabzRipRecord = {
  id: string;
  slabzTransactionId: string;
  packId: string;
  packName: string | null;
  status: SlabzTransactionStatus;
  walletAddress: string;
  priceCents: number | null;
  card: SlabzCard | null;
  createdAt: string;
  updatedAt: string;
};

export type SlabzCatalogStats = {
  catalogCards: number | null;
  assetRows: number | null;
};

export type SlabzWalletBalanceSnapshot = {
  sol: number;
  usdc: number;
  usdcSymbol: string;
  network: "devnet" | "mainnet";
};

export type SlabzPartnerPayload = {
  capabilities: SlabzPartnerCapabilities;
  signedIn: boolean;
  profile: SlabzUserProfile | null;
  recentRips: SlabzRipRecord[];
  catalogStats?: SlabzCatalogStats;
  livePackCount?: number;
  error?: string;
};

export type SlabzPacksPayload = {
  configured: boolean;
  packs: SlabzPack[];
  error?: string;
};
