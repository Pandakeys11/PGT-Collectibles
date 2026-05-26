import { NextRequest, NextResponse } from "next/server";
import { suggestCatalogCandidates } from "@/lib/market/catalog-router";
import { mergeCatalogMatches } from "@/lib/market/catalog-candidate-merge";
import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { catalogMatchIsAuthoritative, resolveCatalogImageUrl } from "@/lib/scan/catalog-merge";
import { extractedCardSchema } from "@/lib/scan/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function catalogPayload(
  catalog: CatalogMatch,
  card: ReturnType<typeof extractedCardSchema.parse>,
) {
  const authoritative = catalogMatchIsAuthoritative(catalog, card);
  return {
    catalogId: authoritative ? catalog.catalogId : null,
    catalogIdentityStatus: catalog.catalogIdentityStatus,
    catalogConfidence: catalog.catalogConfidence,
    catalogCandidates: catalog.candidates,
    identityEvidence: catalog.identityEvidence,
    catalogImageUrl: resolveCatalogImageUrl(catalog, card),
    catalogMatched: authoritative,
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

  const card = parsed.data;
  try {
    const fresh = await suggestCatalogCandidates(card);
    if (!fresh) {
      return NextResponse.json({
        candidates: [],
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

    return NextResponse.json(catalogPayload(merged, card));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Catalog search failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
