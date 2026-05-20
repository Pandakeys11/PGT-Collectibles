import type { MarketSourceLink } from "@/lib/market/sources";

export type SetOverviewSealedRow = {
  id: string;
  label: string;
  category: string;
  searchQuery: string;
  links: MarketSourceLink[];
};

export type SetOverviewPayload =
  | {
      supported: true;
      setId: string;
      setName: string;
      methodology: string;
      setValueNotes?: string;
      bulbapediaUrl?: string;
      pricing: {
        cardCount: number;
        tcgPlayerSumUsd: number;
        tcgPlayerPricedSlots: number;
        cardmarketSumEur: number;
        cardmarketPricedSlots: number;
      };
      sealedProducts: SetOverviewSealedRow[];
      references: { label: string; url: string; note?: string }[];
    }
  | {
      supported: false;
      setId: string;
      setName: string | null;
    };
