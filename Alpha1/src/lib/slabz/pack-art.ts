import type { CatalogFranchiseId } from "@/lib/catalog/catalog-types";
import type { SlabzPack } from "@/lib/slabz/types";

/** Consumer Slabz site — canonical pack GIF paths (partner API often omits imageUrl). */
export const SLABZ_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SLABZ_SITE_URL?.trim() || "https://slabz.com";

export const SLABZ_BRAND_LOGO_URL = `${SLABZ_SITE_ORIGIN}/slabz-new.png`;

/** Pack rip GIFs Slabz hosts on slabz.com (Pokemon 25/50/250/1000, One Piece 250). */
export const SLABZ_KNOWN_PACK_GIF_TYPES = [
  "pokemon_25",
  "pokemon_50",
  "pokemon_250",
  "pokemon_1000",
  "one_piece_250",
  "one-piece_250",
] as const;

export type SlabzKnownPackGifType = (typeof SLABZ_KNOWN_PACK_GIF_TYPES)[number];

export type SlabzPackTier =
  | "starter"
  | "standard"
  | "premium"
  | "elite"
  | "onepiece"
  | "sealed"
  | "unknown";

const PRICE_TO_CC_TYPE: Record<number, string> = {
  2500: "pokemon_25",
  5000: "pokemon_50",
  25000: "pokemon_250",
  100000: "pokemon_1000",
};

const TIER_BY_CC: Record<string, SlabzPackTier> = {
  pokemon_25: "starter",
  pokemon_50: "standard",
  pokemon_250: "premium",
  pokemon_1000: "elite",
  one_piece_250: "onepiece",
  pokemon_sealed: "sealed",
};

export type SlabzPackArtMeta = {
  tier: SlabzPackTier;
  /** Resolved art URL (Slabz site GIF or API imageUrl). */
  imageUrl: string | null;
  accentClass: string;
  glowClass: string;
  foilClass: string;
};

function pickImageUrl(raw: Record<string, unknown>): string | null {
  for (const key of ["imageUrl", "image_url", "image", "packImageUrl", "thumbnailUrl"]) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function inferCcPackType(pack: Pick<SlabzPack, "ccPackType" | "priceCents" | "name" | "category">): string | null {
  if (pack.ccPackType?.trim()) return pack.ccPackType.trim().toLowerCase();
  const name = pack.name.toLowerCase();
  const category = (pack.category ?? "").toLowerCase();

  if (name.includes("one piece") || category.includes("one piece") || category.includes("onepiece")) {
    if (name.includes("250") || pack.priceCents === 25000) return "one_piece_250";
  }
  if (pack.ccPackType?.includes("one-piece")) return "one_piece_250";

  if (pack.priceCents && PRICE_TO_CC_TYPE[pack.priceCents]) {
    return PRICE_TO_CC_TYPE[pack.priceCents];
  }
  if (name.includes("1000") || name.includes("$1000")) return "pokemon_1000";
  if (name.includes("250") || name.includes("$250")) {
    return name.includes("one piece") ? "one_piece_250" : "pokemon_250";
  }
  if (name.includes("50") || name.includes("$50")) return "pokemon_50";
  if (name.includes("25") || name.includes("$25")) return "pokemon_25";
  if (name.includes("sealed")) return "pokemon_sealed";
  return null;
}

export function slabzPackFranchise(
  pack: Pick<SlabzPack, "ccPackType" | "priceCents" | "name" | "category">,
): CatalogFranchiseId {
  const cc = (pack.ccPackType ?? inferCcPackType(pack) ?? "").toLowerCase();
  const name = pack.name.toLowerCase();
  if (cc.includes("one_piece") || name.includes("one piece")) return "onepiece";
  if (cc.includes("pokemon") || name.includes("pokemon") || name.includes("pokémon")) return "pokemon";
  return "sports";
}

/** Map partner `ccPackType` to slabz.com consumer GIF filename (see slabz.com RSC payload). */
export function ccPackTypeToGifFilename(ccPackType: string): string {
  const key = ccPackType.trim().toLowerCase();
  if (key === "one_piece_250") return "one-piece_250.gif";
  if (key.startsWith("one_piece_")) return key.replace(/_/g, "-") + ".gif";
  if (key.endsWith(".gif")) return key;
  return `${key}.gif`;
}

/** Slabz consumer pack GIF path used on slabz.com (same ccPackType as partner API). */
export function slabzSitePackGifUrl(ccPackType: string): string {
  return `${SLABZ_SITE_ORIGIN}/packs/gifs/${ccPackTypeToGifFilename(ccPackType)}`;
}

/** Official CDN still image from partner API docs (`pokemon_50` → `pokemon-50.png`). */
export function slabzCdnPackStillUrl(ccPackType: string): string {
  const slug = ccPackType
    .trim()
    .toLowerCase()
    .replace(/^one_piece_/, "one-piece-")
    .replace(/_/g, "-");
  return `https://cdn.slabz.com/packs/${slug}.png`;
}

export function slabzCdnPackGifUrl(ccPackType: string): string {
  const slug = ccPackType
    .trim()
    .toLowerCase()
    .replace(/^one_piece_/, "one-piece-")
    .replace(/_/g, "-");
  return `https://cdn.slabz.com/packs/${slug}.gif`;
}

export function isSlabzPackGifType(ccPackType: string): boolean {
  const key = ccPackType.trim().toLowerCase();
  return (
    SLABZ_KNOWN_PACK_GIF_TYPES.includes(key as SlabzKnownPackGifType) ||
    /^pokemon_\d+$/.test(key) ||
    /^one_piece_\d+$/.test(key)
  );
}

/** Ordered candidates — first loadable URL wins (Slabz site GIFs + docs CDN). */
export function resolveSlabzPackArtCandidates(
  pack: Pick<SlabzPack, "imageUrl" | "ccPackType" | "priceCents" | "name" | "category">,
): string[] {
  const out: string[] = [];
  const push = (url: string | null | undefined) => {
    const t = url?.trim();
    if (!t || out.includes(t)) return;
    out.push(t);
  };

  push(pack.imageUrl);

  const cc = inferCcPackType(pack);
  if (cc && isSlabzPackGifType(cc)) {
    push(slabzCdnPackGifUrl(cc));
    push(slabzCdnPackStillUrl(cc));
    push(slabzSitePackGifUrl(cc));
  }

  return out;
}

export function resolveSlabzPackImageUrl(
  pack: Pick<SlabzPack, "imageUrl" | "ccPackType" | "priceCents" | "name" | "category">,
): string | null {
  return resolveSlabzPackArtCandidates(pack)[0] ?? null;
}

/** Same-origin proxy so pack GIFs work when Slabz enables assets (and for consistent caching). */
export function slabzPackMediaProxyUrl(
  pack: Pick<SlabzPack, "imageUrl" | "ccPackType" | "priceCents" | "name" | "category">,
): string | null {
  const cc = inferCcPackType(pack);
  if (!cc) return pack.imageUrl?.trim() || null;
  const qs = new URLSearchParams({ cc });
  if (pack.imageUrl?.trim()) qs.set("fallback", pack.imageUrl.trim());
  return `/api/partners/slabz/pack-media?${qs}`;
}

export function slabzPackTier(pack: Pick<SlabzPack, "ccPackType" | "priceCents" | "name">): SlabzPackTier {
  const cc = inferCcPackType(pack);
  if (cc && TIER_BY_CC[cc]) return TIER_BY_CC[cc];
  if (pack.priceCents >= 100_000) return "elite";
  if (pack.priceCents >= 25_000) return "premium";
  if (pack.priceCents >= 5_000) return "standard";
  if (pack.priceCents >= 2_500) return "starter";
  return "unknown";
}

const TIER_STYLES: Record<SlabzPackTier, { accent: string; glow: string; foil: string }> = {
  starter: {
    accent: "from-emerald-400/90 via-teal-300/80 to-cyan-400/70",
    glow: "shadow-[0_0_28px_rgba(52,211,153,0.35)]",
    foil: "from-emerald-950/80 via-teal-900/60 to-slate-950",
  },
  standard: {
    accent: "from-cyan-400/95 via-sky-300/85 to-blue-500/75",
    glow: "shadow-[0_0_32px_rgba(34,211,238,0.4)]",
    foil: "from-cyan-950/85 via-sky-950/70 to-slate-950",
  },
  premium: {
    accent: "from-violet-400/95 via-fuchsia-300/85 to-purple-500/75",
    glow: "shadow-[0_0_32px_rgba(192,132,252,0.42)]",
    foil: "from-violet-950/85 via-fuchsia-950/65 to-slate-950",
  },
  elite: {
    accent: "from-amber-300/95 via-yellow-200/85 to-orange-400/80",
    glow: "shadow-[0_0_36px_rgba(251,191,36,0.45)]",
    foil: "from-amber-950/90 via-orange-950/70 to-slate-950",
  },
  onepiece: {
    accent: "from-rose-400/95 via-red-300/85 to-orange-500/75",
    glow: "shadow-[0_0_32px_rgba(251,113,133,0.42)]",
    foil: "from-rose-950/85 via-red-950/65 to-slate-950",
  },
  sealed: {
    accent: "from-slate-300/90 via-zinc-200/80 to-slate-400/70",
    glow: "shadow-[0_0_24px_rgba(148,163,184,0.3)]",
    foil: "from-slate-900/90 via-zinc-900/75 to-black",
  },
  unknown: {
    accent: "from-cyan-400/80 via-violet-300/70 to-fuchsia-400/65",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.28)]",
    foil: "from-slate-900/85 via-violet-950/55 to-slate-950",
  },
};

export function getSlabzPackArtMeta(
  pack: Pick<SlabzPack, "imageUrl" | "ccPackType" | "priceCents" | "name">,
): SlabzPackArtMeta {
  const tier = slabzPackTier(pack);
  const styles = TIER_STYLES[tier];
  return {
    tier,
    imageUrl: resolveSlabzPackImageUrl(pack),
    accentClass: styles.accent,
    glowClass: styles.glow,
    foilClass: styles.foil,
  };
}

export function normalizeSlabzPack(raw: Record<string, unknown>): SlabzPack {
  const priceCents = Number(raw.priceCents ?? raw.price_cents ?? 0);
  const pack: SlabzPack = {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? "Mystery pack"),
    description:
      typeof raw.description === "string" ? raw.description : (raw.description as null) ?? null,
    priceCents: Number.isFinite(priceCents) ? priceCents : 0,
    imageUrl: pickImageUrl(raw),
    category: typeof raw.category === "string" ? raw.category : null,
    available: raw.available !== false && raw.isActive !== false,
    ccPackType:
      typeof raw.ccPackType === "string"
        ? raw.ccPackType
        : typeof raw.cc_pack_type === "string"
          ? raw.cc_pack_type
          : null,
    isActive: raw.isActive !== false,
  };

  if (!pack.imageUrl) {
    pack.imageUrl = resolveSlabzPackImageUrl(pack);
  }

  return pack;
}
