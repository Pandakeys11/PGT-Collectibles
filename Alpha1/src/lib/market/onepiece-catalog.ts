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

type OpCard = {
  card_set_id?: string;
  card_name?: string;
  card_image?: string;
  rarity?: string;
  set_name?: string;
  set_id?: string;
};

function normalizeOpCardId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m =
    compact.match(/^(OP|ST|EB|PRB?)(\d{1,2})-?(\d{1,3})$/i) ??
    compact.match(/^(OP|ST|EB)(\d{1,2})(\d{3})$/i);
  if (!m) return null;
  const prefix = m[1].toUpperCase();
  const setNum = m[2].padStart(2, "0");
  const cardNum = m[3].padStart(3, "0");
  return `${prefix}${setNum}-${cardNum}`;
}

export async function matchOnepieceCatalog(card: ExtractedCard): Promise<CatalogMatch | null> {
  if (inferCardFranchise(card).id !== "onepiece") return null;
  const name = effectiveCatalogSearchName(card);
  const opId = normalizeOpCardId(card.number) ?? normalizeOpCardId(card.printStamps);
  if (!opId && !name) return null;

  const hits: OpCard[] = [];
  if (opId) {
    const byId = await fetchJson<OpCard | OpCard[]>(`https://optcgapi.com/api/sets/card/${opId}/`);
    if (Array.isArray(byId)) hits.push(...byId);
    else if (byId && typeof byId === "object") hits.push(byId);
  }

  if (hits.length === 0 && name) {
    const search = await fetchJson<{ cards?: OpCard[] } | OpCard[]>(
      `https://optcgapi.com/api/sets/search/?search=${encodeURIComponent(name)}`,
    );
    if (Array.isArray(search)) hits.push(...search);
    else if (search && "cards" in search && Array.isArray(search.cards)) hits.push(...search.cards);
  }

  if (hits.length === 0) return null;

  const rows = hits.map((hit) => {
    const displayName = hit.card_name ?? name ?? "Unknown";
    const scored = scoreNameSetNumber(
      card,
      {
        name: displayName,
        setName: hit.set_name ?? card.set ?? null,
        cardNumber: hit.card_set_id ?? opId ?? card.number ?? null,
        year: null,
      },
      { franchiseHint: "onepiece" },
    );
    if (opId && normalizeOpCardId(hit.card_set_id) === opId) {
      scored.score = Math.min(100, scored.score + 15);
      scored.reasons.push("op_id");
    }
    return {
      catalogId: `optcg:${hit.card_set_id ?? opId ?? displayName}`,
      name: displayName,
      setName: hit.set_name ?? card.set ?? null,
      cardNumber: hit.card_set_id ?? opId ?? card.number ?? null,
      year: null,
      rarity: hit.rarity ?? card.rarity ?? null,
      score: scored.score,
      confidence: scored.score / 100,
      reasons: scored.reasons,
      conflicts: scored.conflicts,
      imageSmallUrl: hit.card_image ?? null,
      imageLargeUrl: hit.card_image ?? null,
      prices: {
        tcgPlayerUrl: `https://www.tcgplayer.com/search/one-piece-card-game/product?q=${encodeURIComponent(displayName)}`,
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
      extracted: opId ?? normalizeCatalogToken(name),
      catalog: "OPTCG API",
      status: "info",
      weight: 86,
      reason: "One Piece TCG catalog match via OPTCG API.",
    },
  ];

  return buildCatalogMatch(rows, evidence, opId ? "strict" : "loose");
}
