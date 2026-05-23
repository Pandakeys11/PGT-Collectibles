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

type YgoCardSet = {
  set_name?: string;
  set_code?: string;
  set_rarity?: string;
  set_price?: string;
};

type YgoCard = {
  id: number;
  name: string;
  type?: string;
  card_sets?: YgoCardSet[];
  card_images?: Array<{ image_url?: string; image_url_small?: string }>;
};

type YgoResponse = { data?: YgoCard[] };

function pickBestSet(card: ExtractedCard, sets: YgoCardSet[]): YgoCardSet | null {
  if (!sets.length) return null;
  const want = normalizeCatalogToken(card.set);
  if (!want) return sets[0] ?? null;
  return (
    sets.find((s) => normalizeCatalogToken(s.set_name).includes(want) || want.includes(normalizeCatalogToken(s.set_name))) ??
    sets[0] ??
    null
  );
}

export async function matchYugiohCatalog(card: ExtractedCard): Promise<CatalogMatch | null> {
  if (inferCardFranchise(card).id !== "yugioh") return null;
  const name = effectiveCatalogSearchName(card);
  if (!name) return null;

  const params = new URLSearchParams();
  if (card.number?.trim()) {
    params.set("cardset", card.number.trim());
  }
  params.set("fname", name);

  const payload = await fetchJson<YgoResponse>(
    `https://db.ygoprodeck.com/api/v7/cardinfo.php?${params.toString()}`,
    { timeoutMs: 14_000 },
  );
  const cards = payload?.data ?? [];
  if (cards.length === 0) {
    const exact = await fetchJson<YgoResponse>(
      `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(name)}`,
    );
    if (exact?.data?.length) cards.push(...exact.data);
  }
  if (cards.length === 0) return null;

  const rows = cards.flatMap((hit) => {
    const sets = hit.card_sets ?? [];
    const targets = sets.length > 0 ? [pickBestSet(card, sets)!].filter(Boolean) : [null];
    return targets.map((setRow) => {
      const image = hit.card_images?.[0];
      const scored = scoreNameSetNumber(
        card,
        {
          name: hit.name,
          setName: setRow?.set_name ?? card.set ?? null,
          cardNumber: setRow?.set_code ?? card.number ?? null,
          year: null,
        },
        { franchiseHint: "yugioh" },
      );
      return {
        catalogId: `ygo:${hit.id}${setRow?.set_code ? `:${setRow.set_code}` : ""}`,
        name: hit.name,
        setName: setRow?.set_name ?? card.set ?? null,
        cardNumber: setRow?.set_code ?? card.number ?? null,
        year: null,
        rarity: setRow?.set_rarity ?? card.rarity ?? null,
        score: scored.score,
        confidence: scored.score / 100,
        reasons: scored.reasons,
        conflicts: scored.conflicts,
        imageSmallUrl: image?.image_url_small ?? image?.image_url ?? null,
        imageLargeUrl: image?.image_url ?? null,
        prices: {
          tcgPlayerUrl: `https://www.tcgplayer.com/search/yugioh/product?q=${encodeURIComponent(hit.name)}`,
          tcgPlayerUpdatedAt: null,
          tcgPlayerPrices: [],
          cardMarketUrl: null,
          cardMarketUpdatedAt: null,
          cardMarket: null,
        },
      };
    });
  });

  const evidence: IdentityEvidence[] = [
    {
      field: "catalog",
      extracted: normalizeCatalogToken(name),
      catalog: "YGOPRODeck",
      status: "info",
      weight: 88,
      reason: "Yu-Gi-Oh! catalog match via YGOPRODeck API.",
    },
  ];

  return buildCatalogMatch(rows, evidence, "strict");
}
