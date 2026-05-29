/**
 * Shared Tailwind grids for master catalog set + card browsers (desktop + mobile).
 */

/** Set tiles — narrow sidebar when a set is open beside the card grid. */
export const CATALOG_SET_GRID_SIDEBAR =
  "grid-cols-2 gap-1.5 sm:grid-cols-2 lg:grid-cols-2";

/**
 * Master catalog set picker — 4×4 style (4 columns from md up).
 * Full-width embedded browse and standalone set list.
 */
export const CATALOG_SET_GRID_BROWSE =
  "grid-cols-2 gap-1.5 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4";

/** Standalone / wide pages — can show extra column on very large screens. */
export const CATALOG_SET_GRID_FULL =
  "grid-cols-2 gap-1.5 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

/** @deprecated Use CATALOG_SET_GRID_SIDEBAR */
export const CATALOG_SET_GRID_COMPACT = CATALOG_SET_GRID_SIDEBAR;

/**
 * Card grid — 4 columns; tiles fill column width (~4 rows visible in catalog pane).
 */
export const CATALOG_CARD_GRID_4X4 =
  "sc-catalog-card-grid-4x4 grid-cols-4 gap-1.5 sm:gap-2";

/** @deprecated Prefer CATALOG_CARD_GRID_4X4 */
export const CATALOG_CARD_GRID_DEFAULT = CATALOG_CARD_GRID_4X4;

/** @deprecated Prefer CATALOG_CARD_GRID_4X4 */
export const CATALOG_CARD_GRID_EMBEDDED = CATALOG_CARD_GRID_4X4;

/** Mobile stepped flow — column count tuned in scanner-chat.css */
export const CATALOG_CARD_GRID_MOBILE_STEP = "sc-catalog-card-grid-4x4 grid gap-1.5";

/** Card art fills tile width; 5:7 Pokémon aspect */
export const CATALOG_CARD_ART_FRAME = "relative w-full aspect-[5/7] bg-subtle";

/** @deprecated Use CATALOG_CARD_ART_FRAME */
export const CATALOG_CARD_ASPECT = CATALOG_CARD_ART_FRAME;

export const CATALOG_CARD_SHELL =
  "sc-catalog-card-tile overflow-hidden rounded-lg border border-border-subtle bg-panel-raised/50 text-left transition touch-manipulation";

export const CATALOG_CARD_IMAGE_PAD = "p-0.5 sm:p-1";

export const CATALOG_CARD_FOOTER = "border-t border-white/8 px-1.5 py-1 sm:px-2 sm:py-1.5";

export const CATALOG_CARD_NAME_CLASS =
  "min-w-0 line-clamp-2 text-[10px] font-semibold leading-snug text-primary sm:text-[11px]";

export const CATALOG_CARD_META_CLASS =
  "mt-0.5 line-clamp-1 text-[9px] leading-tight text-muted sm:text-[10px]";
