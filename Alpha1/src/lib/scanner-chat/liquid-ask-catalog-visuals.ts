import { matchPokemonCatalog } from "@/lib/market/pokemon-catalog";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";
import type { LiquidAskCatalogCard } from "@/lib/scanner-chat/liquid-ask-types";

function cardKey(card: Pick<LiquidAskCatalogCard, "catalogId" | "name" | "setName" | "number">): string {
  if (card.catalogId?.trim()) return `id:${card.catalogId}`;
  return `n:${card.name}|${card.setName ?? ""}|${card.number ?? ""}`;
}

/** Master catalog artwork for PGT Ask — session rows first, then catalog match fallback. */
export async function resolveLiquidAskCatalogCards(args: {
  contexts: ScanCardContext[];
  focusSpecimenId?: string | null;
  researchCard: ExtractedCard | null;
}): Promise<LiquidAskCatalogCard[]> {
  const out: LiquidAskCatalogCard[] = [];
  const seen = new Set<string>();

  const push = (card: LiquidAskCatalogCard) => {
    const url = card.imageUrl?.trim();
    if (!url) return;
    const key = cardKey(card);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ ...card, imageUrl: url });
  };

  const focusId = args.focusSpecimenId ?? null;
  const ordered =
    focusId != null
      ? [
          ...args.contexts.filter((c) => c.specimenId === focusId),
          ...args.contexts.filter((c) => c.specimenId !== focusId),
        ]
      : args.contexts;

  for (const ctx of ordered.slice(0, 6)) {
    const url = ctx.catalogImageUrl?.trim();
    if (!url) continue;
    push({
      catalogId: ctx.catalogId,
      name: ctx.name,
      setName: ctx.setName,
      number: ctx.cardNumber,
      imageUrl: url,
      role: ctx.specimenId === focusId ? "focus" : "session",
      rawFmvUsd: ctx.fairValueUsd,
    });
  }

  if (out.length === 0 && args.researchCard?.name?.trim()) {
    try {
      const match = await matchPokemonCatalog(args.researchCard);
      const img = match?.imageSmallUrl ?? match?.imageLargeUrl ?? match?.imageUrl;
      if (match && img) {
        push({
          catalogId: match.catalogId,
          name: match.name,
          setName: match.setName,
          number: match.cardNumber,
          imageUrl: img,
          role: "reference",
          rawFmvUsd:
            match.prices?.tcgPlayerPrices?.find((p) => p.market != null)?.market ??
            match.prices?.tcgPlayerPrices?.[0]?.market ??
            null,
        });
      }
    } catch {
      /* optional enrichment */
    }
  }

  return out.slice(0, 6);
}
