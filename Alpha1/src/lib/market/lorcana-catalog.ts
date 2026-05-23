import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import {
  buildCatalogMatch,
  fetchJson,
  normalizeCatalogToken,
  scoreNameSetNumber,
} from "@/lib/market/catalog-match-utils";
import { effectiveCatalogSearchName } from "@/lib/scan/card-display";
import { inferCardFranchise } from "@/lib/scan/franchise";
import type { ExtractedCard, IdentityEvidence } from "@/lib/scan/schemas";

type LorcastCard = {
  id: string;
  name: string;
  version?: string | null;
  collector_number?: string;
  rarity?: string;
  released_at?: string;
  set?: { name?: string; code?: string };
  image_uris?: { digital?: { small?: string; normal?: string; large?: string } };
  purchase_uris?: { tcgplayer?: string };
  prices?: { usd?: number | null };
};

type LorcastSearch = { results?: LorcastCard[] };

function displayName(card: LorcastCard): string {
  return card.version?.trim() ? `${card.name} — ${card.version}` : card.name;
}

export async function matchLorcanaCatalog(card: ExtractedCard): Promise<CatalogMatch | null> {
  if (inferCardFranchise(card).id !== "lorcana") return null;
  const name = effectiveCatalogSearchName(card);
  if (!name) return null;

  const q = [name, card.set, card.number].filter(Boolean).join(" ");
  const payload = await fetchJson<LorcastSearch>(
    `https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(q)}`,
    { timeoutMs: 14_000 },
  );
  const hits = payload?.results ?? [];
  if (hits.length === 0) return null;

  const rows = hits.map((hit) => {
    const label = displayName(hit);
    const images = hit.image_uris?.digital;
    const year = hit.released_at?.slice(0, 4) ?? null;
    const scored = scoreNameSetNumber(
      card,
      {
        name: label,
        setName: hit.set?.name ?? card.set ?? null,
        cardNumber: hit.collector_number ?? card.number ?? null,
        year,
      },
      { franchiseHint: "lorcana" },
    );
    return {
      catalogId: `lorcast:${hit.id}`,
      name: label,
      setName: hit.set?.name ?? card.set ?? null,
      cardNumber: hit.collector_number ?? card.number ?? null,
      year,
      rarity: hit.rarity ?? card.rarity ?? null,
      score: scored.score,
      confidence: scored.score / 100,
      reasons: scored.reasons,
      conflicts: scored.conflicts,
      imageSmallUrl: images?.small ?? images?.normal ?? null,
      imageLargeUrl: images?.large ?? images?.normal ?? null,
      prices: {
        tcgPlayerUrl: hit.purchase_uris?.tcgplayer ?? null,
        tcgPlayerUpdatedAt: null,
        tcgPlayerPrices: [],
        cardMarketUrl: null,
        cardMarketUpdatedAt: null,
        cardMarket: null,
      },
    };
  });

  const evidence: IdentityEvidence[] = [
    {
      field: "catalog",
      extracted: normalizeCatalogToken(name),
      catalog: "Lorcast",
      status: "info",
      weight: 86,
      reason: "Disney Lorcana catalog match via Lorcast API.",
    },
  ];

  return buildCatalogMatch(rows, evidence, "strict");
}
