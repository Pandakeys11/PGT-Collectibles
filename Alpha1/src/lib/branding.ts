/**
 * Curated brand assets under /public/branding.
 * Only paths we actively use in UI — avoids noisy one-off renders.
 */
export const BRAND = {
  logoIcon: "/branding/logo-icon.png",
  logoMark: "/branding/logo-mark.png",
  /** Subtle tiled texture for dark panels (use at low opacity). */
  textureOoze: "/branding/liquid_vault_vision_ooze_1777309486368.png",
  /** Scanner / intel hero — auth & empty states only. */
  heroNeuralVision: "/branding/liquid_vault_neural_vision_detailed_1777309165982.png",
} as const;

export const BRAND_COPY = {
  name: "PGT Collectibles",
  shortName: "PGT",
  tagline: "Vision · Catalog · Market",
  authTagline: "Institutional-grade Pokémon TCG intelligence",
} as const;
