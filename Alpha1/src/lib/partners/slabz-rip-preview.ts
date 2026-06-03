import type { SlabzPack } from "@/lib/slabz/types";

/**
 * Pre-launch demo — full rip flow stays enabled for testing; UI shows demo / coming-soon notices.
 * Set to `false` when live Slabz Ripz launches.
 */
export const SLABZ_RIP_DEMO_MODE = true;

export const SLABZ_RIP_PARTNERSHIP = {
  collaboration: "PGT × Slabz × Omega",
  demoLabel: "Demo",
  liveLabel: "Live Slabz Ripz coming soon",
  tagline:
    "Partnership collaboration in progress — graded slab pack rips, wallet-native reveals, and Liquid Scan handoff at launch.",
  demoWarning:
    "Demo mode — test ripz on devnet with USDC-DEV. Live Slabz Ripz with PGT × Slabz × Omega launches soon; balances and inventory may reset.",
  demoShort: "Demo · live Ripz coming soon",
} as const;

/** Optional static art reference (marketing / idle copy). */
export const SLABZ_RIP_PREVIEW_PACKS: SlabzPack[] = [
  {
    id: "preview-pokemon-50",
    name: "Pokémon $50",
    description: "Demo preview",
    priceCents: 5000,
    ccPackType: "pokemon_50",
    category: "pokemon",
    available: true,
    isActive: true,
  },
  {
    id: "preview-pokemon-250",
    name: "Pokémon $250",
    description: "Demo preview",
    priceCents: 25000,
    ccPackType: "pokemon_250",
    category: "pokemon",
    available: true,
    isActive: true,
  },
];
