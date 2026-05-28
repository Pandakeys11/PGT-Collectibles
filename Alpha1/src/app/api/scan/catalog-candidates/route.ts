import { NextRequest, NextResponse } from "next/server";
import { mergeCatalogMatches } from "@/lib/market/catalog-candidate-merge";
import { ensureCatalogMatchOptions } from "@/lib/market/ensure-catalog-options";
import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { resolveLocalizedCatalogArtwork } from "@/lib/catalog/localized-artwork";
import {
  resolveCatalogImageUrl,
  resolveCatalogPreviewImageUrl,
  trustedCatalogMatch,
} from "@/lib/scan/catalog-merge";
import { normalizeJapanesePokemonIdentity } from "@/lib/scan/japanese-pokemon";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function catalogPayload(
  catalog: CatalogMatch,
  card: ReturnType<typeof extractedCardSchema.parse>,
) {
  const trusted = trustedCatalogMatch(catalog, card);
  const catalogId = trusted
    ? (catalog.catalogId ?? catalog.candidates[0]?.catalogId ?? null)
    : null;
  const fallbackImageUrl =
    resolveCatalogImageUrl(catalog, card) ??
    resolveCatalogPreviewImageUrl(catalog, card);
  const localizedArtwork = await resolveLocalizedCatalogArtwork({
    card,
    catalog,
    fallbackImageUrl,
  });

  return {
    catalogId,
    catalogIdentityStatus: catalog.catalogIdentityStatus,
    catalogConfidence: catalog.catalogConfidence,
    candidates: catalog.candidates,
    catalogCandidates: catalog.candidates,
    identityEvidence: catalog.identityEvidence,
    catalogImageUrl:
      localizedArtwork?.imageSmallUrl ??
      localizedArtwork?.imageLargeUrl ??
      fallbackImageUrl,
    catalogImageSource: localizedArtwork?.status ?? null,
    catalogImageSourceLabel: localizedArtwork?.sourceLabel ?? null,
    catalogImageNeedsReview: localizedArtwork?.needsReview ?? false,
    catalogMatched: trusted,
  };
}

export async function POST(req: NextRequest) {
  let body: { card?: unknown; existingCandidates?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = extractedCardSchema.safeParse(body.card);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid card payload" }, { status: 400 });
  }

  const card = normalizeJapanesePokemonIdentity(parsed.data);
  try {
    const fresh = await ensureCatalogMatchOptions(card);
    if (!fresh || fresh.candidates.length === 0) {
      return NextResponse.json({
        candidates: [],
        catalogCandidates: [],
        catalogIdentityStatus: "failed" as const,
        catalogConfidence: 0,
        catalogId: null,
        catalogImageUrl: null,
        identityEvidence: [],
        catalogMatched: false,
      });
    }

    const existingParsed = Array.isArray(body.existingCandidates)
      ? body.existingCandidates
      : [];
    let merged = fresh;
    if (existingParsed.length > 0) {
      const stub: CatalogMatch = {
        ...fresh,
        candidates: existingParsed as CatalogMatch["candidates"],
      };
      merged = mergeCatalogMatches(stub, fresh) ?? fresh;
    }

    return NextResponse.json(await catalogPayload(merged, card));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Catalog search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
