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

const USER_AGENT = "PGTVision/1.0 (https://github.com/Pandakeys11/PGT-Collectibles)";

type ScryfallCard = {
  id: string;
  name: string;
  set_name?: string;
  collector_number?: string;
  released_at?: string;
  rarity?: string;
  image_uris?: { small?: string; normal?: string; large?: string };
  card_faces?: Array<{ image_uris?: { small?: string; normal?: string; large?: string } }>;
  prices?: { usd?: string | null; tcgplayer_url?: string | null };
};

type ScryfallList = { data: ScryfallCard[] };

function escapeScryfall(value: string): string {
  return value.replace(/"/g, '\\"');
}

function cardImages(card: ScryfallCard): { small: string | null; large: string | null } {
  const primary = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  return {
    small: primary?.small ?? primary?.normal ?? null,
    large: primary?.large ?? primary?.normal ?? null,
  };
}

function buildQueries(card: ExtractedCard, name: string): string[] {
  const queries: string[] = [];
  const set = card.set?.trim();
  const num = card.number?.trim();
  if (set && num) {
    queries.push(`!"${escapeScryfall(name)}" set:"${escapeScryfall(set)}" number:${escapeScryfall(num.split("/")[0] ?? num)}`);
  }
  if (set) queries.push(`!"${escapeScryfall(name)}" set:"${escapeScryfall(set)}"`);
  if (num) {
    const head = num.split("/")[0]?.trim();
    if (head) queries.push(`!"${escapeScryfall(name)}" number:${escapeScryfall(head)}`);
  }
  queries.push(`!"${escapeScryfall(name)}"`);
  return Array.from(new Set(queries));
}

export async function matchScryfallCatalog(card: ExtractedCard): Promise<CatalogMatch | null> {
  if (inferCardFranchise(card).id !== "magic") return null;
  const name = effectiveCatalogSearchName(card);
  if (!name) return null;

  const hits: ScryfallCard[] = [];
  const seen = new Set<string>();
  for (const q of buildQueries(card, name)) {
    const encoded = encodeURIComponent(q);
    const list = await fetchJson<ScryfallList>(
      `https://api.scryfall.com/cards/search?q=${encoded}&unique=prints&order=name`,
      { headers: { "User-Agent": USER_AGENT }, timeoutMs: 14_000 },
    );
    for (const row of list?.data ?? []) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      hits.push(row);
    }
    if (hits.length >= 12) break;
  }

  if (hits.length === 0) {
    const fuzzy = await fetchJson<ScryfallCard>(
      `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (fuzzy?.id) hits.push(fuzzy);
  }

  if (hits.length === 0) return null;

  const rows = hits.map((hit) => {
    const images = cardImages(hit);
    const year = hit.released_at?.slice(0, 4) ?? null;
    const scored = scoreNameSetNumber(
      card,
      {
        name: hit.name,
        setName: hit.set_name ?? null,
        cardNumber: hit.collector_number ?? null,
        year,
      },
      { franchiseHint: "magic" },
    );
    const tcgUrl =
      typeof hit.prices?.tcgplayer_url === "string"
        ? hit.prices.tcgplayer_url
        : hit.prices?.usd
          ? `https://www.tcgplayer.com/search/magic/product?q=${encodeURIComponent(hit.name)}`
          : null;
    return {
      catalogId: `scryfall:${hit.id}`,
      name: hit.name,
      setName: hit.set_name ?? null,
      cardNumber: hit.collector_number ?? null,
      year,
      rarity: hit.rarity ?? null,
      score: scored.score,
      confidence: scored.score / 100,
      reasons: scored.reasons,
      conflicts: scored.conflicts,
      imageSmallUrl: images.small,
      imageLargeUrl: images.large,
      prices: {
        tcgPlayerUrl: tcgUrl,
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
      catalog: "Scryfall",
      status: "info",
      weight: 90,
      reason: "Magic: The Gathering catalog match via Scryfall API.",
    },
  ];

  return buildCatalogMatch(rows, evidence, "strict");
}
