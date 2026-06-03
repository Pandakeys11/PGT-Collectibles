import "server-only";

import type { SlabzPack } from "@/lib/slabz/types";
import { SLABZ_SITE_ORIGIN } from "@/lib/slabz/pack-art";

export type SlabzSitePackEntry = {
  key: string;
  name: string;
  description: string | null;
  /** Site-relative path, e.g. `/packs/gifs/pokemon_50.gif` */
  imagePath: string | null;
  priceUsdCents: number;
};

const SITE_CATALOG_TTL_MS = 60 * 60 * 1000;
let cachedCatalog: SlabzSitePackEntry[] | null = null;
let cachedAt = 0;

function parseSitePacksFromHtml(html: string): SlabzSitePackEntry[] {
  const entries: SlabzSitePackEntry[] = [];
  const re =
    /\\"key\\":\\"(slabz_[^\\"]+)\\"[^}]*?\\"name\\":\\"([^\\"]*)\\"[^}]*?\\"imageUrl\\":(?:null|\\"([^\\"]*)\\")[^}]*?\\"priceUsdCents\\":(\d+)/g;

  for (const m of html.matchAll(re)) {
    const name = m[2]
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\u00e9/gi, "é");
    const imagePath = m[3]?.trim() ? m[3] : null;
    entries.push({
      key: m[1],
      name,
      description: null,
      imagePath,
      priceUsdCents: Number(m[4]),
    });
  }

  const descRe =
    /\\"key\\":\\"(slabz_[^\\"]+)\\"[^}]*?\\"description\\":\\"([^\\"]*)\\"/g;
  const descByKey = new Map<string, string>();
  for (const m of html.matchAll(descRe)) {
    descByKey.set(m[1], m[2].replace(/\\n/g, "\n"));
  }
  for (const entry of entries) {
    entry.description = descByKey.get(entry.key) ?? null;
  }

  return entries;
}

export async function fetchSlabzSitePackCatalog(): Promise<SlabzSitePackEntry[]> {
  const now = Date.now();
  if (cachedCatalog && now - cachedAt < SITE_CATALOG_TTL_MS) {
    return cachedCatalog;
  }

  try {
    const res = await fetch(SLABZ_SITE_ORIGIN, {
      headers: { Accept: "text/html", "User-Agent": "PGT-Vision/1.0 (Slabz partner)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`slabz.com ${res.status}`);
    const html = await res.text();
    cachedCatalog = parseSitePacksFromHtml(html);
    cachedAt = now;
    return cachedCatalog;
  } catch (err) {
    console.warn("[slabz] site pack catalog", err);
    return cachedCatalog ?? [];
  }
}

export function sitePackEntryForPartnerPack(
  pack: Pick<SlabzPack, "ccPackType" | "priceCents" | "name">,
  catalog: SlabzSitePackEntry[],
): SlabzSitePackEntry | null {
  if (!catalog.length) return null;

  const cc = pack.ccPackType?.trim().toLowerCase();
  if (cc) {
    const byKey = catalog.find(
      (e) =>
        e.key === `slabz_${cc}` ||
        e.key === `slabz_${cc.replace(/_/g, "-")}` ||
        e.key.endsWith(`_${cc}`),
    );
    if (byKey) return byKey;
    const hyphenCc = cc.replace(/_/g, "-");
    const byHyphen = catalog.find((e) => e.key.includes(hyphenCc));
    if (byHyphen) return byHyphen;
  }

  if (pack.priceCents) {
    const byPrice = catalog.find((e) => e.priceUsdCents === pack.priceCents);
    if (byPrice) return byPrice;
  }

  const name = pack.name.toLowerCase();
  return (
    catalog.find((e) => e.name.toLowerCase() === name) ??
    catalog.find((e) => name.includes(String(e.priceUsdCents / 100))) ??
    null
  );
}

export function absoluteSlabzSiteAsset(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith("http")) return trimmed;
  return `${SLABZ_SITE_ORIGIN}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

export function hydratePackFromSiteCatalog(
  pack: SlabzPack,
  catalog: SlabzSitePackEntry[],
): SlabzPack {
  const entry = sitePackEntryForPartnerPack(pack, catalog);
  if (!entry) return pack;

  const imageUrl = entry.imagePath ? absoluteSlabzSiteAsset(entry.imagePath) : pack.imageUrl;
  return {
    ...pack,
    name: pack.name || entry.name,
    description: pack.description ?? entry.description,
    imageUrl: pack.imageUrl ?? imageUrl,
  };
}
