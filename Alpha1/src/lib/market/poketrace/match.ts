import { pokeTraceGet } from "@/lib/market/poketrace/client";
import {
  gameForCard,
  marketForCard,
  variantForCard,
} from "@/lib/market/poketrace/tiers";
import type { PokeTraceCard } from "@/lib/market/poketrace/types";
import type { ExtractedCard } from "@/lib/scan/schemas";

export function scoreCardMatch(candidate: PokeTraceCard, card: ExtractedCard): number {
  let score = 0;
  const name = card.name?.trim().toLowerCase();
  const cName = candidate.name?.trim().toLowerCase();
  if (name && cName && (cName === name || cName.includes(name) || name.includes(cName))) {
    score += 4;
  }
  const num = card.number?.replace(/^#/, "").trim();
  const cNum = candidate.cardNumber?.replace(/^#/, "").trim();
  if (num && cNum && num === cNum) score += 5;
  const set = card.set?.trim().toLowerCase();
  const cSet = candidate.set?.name?.trim().toLowerCase();
  if (set && cSet && (cSet.includes(set) || set.includes(cSet))) score += 3;
  return score;
}

export async function searchPokeTraceCards(card: ExtractedCard): Promise<PokeTraceCard[]> {
  const params: Record<string, string> = {
    limit: "20",
    game: gameForCard(card),
    market: marketForCard(card),
    product_type: "single",
  };
  if (card.name?.trim()) params.search = card.name.trim().slice(0, 80);
  const num = card.number?.replace(/^#/, "").trim();
  if (num) params.card_number = num;
  const variant = variantForCard(card);
  if (variant) params.variant = variant;

  const payload = await pokeTraceGet<{ data?: PokeTraceCard[] }>("/cards", params);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function fetchPokeTraceCardById(pokeTraceId: string): Promise<PokeTraceCard | null> {
  const id = pokeTraceId.trim();
  if (!id) return null;
  const payload = await pokeTraceGet<{ data?: PokeTraceCard; card?: PokeTraceCard }>(
    `/cards/${encodeURIComponent(id)}`,
  );
  return payload?.data ?? payload?.card ?? null;
}

export function pokeTraceCardUrl(card: PokeTraceCard): string | null {
  const tcgId = card.refs?.tcgplayerId?.trim();
  if (tcgId) return `https://www.tcgplayer.com/product/${tcgId}`;
  return `https://poketrace.com/cards/${card.id}`;
}

export function observedAtFromCard(card: PokeTraceCard): string | null {
  const raw = card.lastUpdated?.trim();
  if (!raw) return null;
  return raw.slice(0, 10);
}
