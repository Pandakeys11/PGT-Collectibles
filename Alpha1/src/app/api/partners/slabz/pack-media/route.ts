import { NextRequest, NextResponse } from "next/server";
import {
  inferCcPackType,
  resolveSlabzPackArtCandidates,
  slabzCdnPackGifUrl,
  slabzCdnPackStillUrl,
  slabzSitePackGifUrl,
} from "@/lib/slabz/pack-art";
import { absoluteSlabzSiteAsset, fetchSlabzSitePackCatalog } from "@/lib/slabz/site-pack-catalog";

export const dynamic = "force-dynamic";

async function tryFetchAsset(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "image/*,*/*",
        Referer: "https://slabz.com/",
        "User-Agent": "PGT-Vision/1.0 (Slabz partner)",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!res.ok || !res.body) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/html")) return null;
    return res;
  } catch {
    return null;
  }
}

/**
 * Proxies Slabz pack rip GIF / still art (site `/packs/gifs/*`, docs CDN).
 * Use: `/api/partners/slabz/pack-media?cc=pokemon_50`
 */
export async function GET(req: NextRequest) {
  const cc = req.nextUrl.searchParams.get("cc")?.trim().toLowerCase();
  const fallback = req.nextUrl.searchParams.get("fallback")?.trim();

  if (!cc) {
    return NextResponse.json({ error: "cc query param required" }, { status: 400 });
  }

  const candidates: string[] = [];
  const push = (url: string | null | undefined) => {
    const t = url?.trim();
    if (t && !candidates.includes(t)) candidates.push(t);
  };

  push(fallback);
  for (const url of resolveSlabzPackArtCandidates({
    ccPackType: cc,
    imageUrl: fallback ?? null,
    name: "",
    priceCents: 0,
  })) {
    push(url);
  }

  try {
    const siteCatalog = await fetchSlabzSitePackCatalog();
    const entry = siteCatalog.find(
      (e) =>
        e.key === `slabz_${cc}` ||
        e.key.replace(/-/g, "_") === `slabz_${cc}` ||
        e.imagePath?.includes(cc.replace(/_/g, "-")),
    );
    if (entry?.imagePath) push(absoluteSlabzSiteAsset(entry.imagePath));
  } catch {
    /* optional */
  }

  push(slabzCdnPackGifUrl(cc));
  push(slabzCdnPackStillUrl(cc));
  push(slabzSitePackGifUrl(cc));

  const inferred = inferCcPackType({ ccPackType: cc, name: "", priceCents: 0 });
  if (inferred && inferred !== cc) {
    push(slabzSitePackGifUrl(inferred));
    push(slabzCdnPackStillUrl(inferred));
  }

  for (const url of candidates) {
    const upstream = await tryFetchAsset(url);
    if (!upstream) continue;

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("Content-Type", contentType);
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

    return new NextResponse(upstream.body, { status: 200, headers });
  }

  return NextResponse.json({ error: "Pack art not available upstream" }, { status: 404 });
}
