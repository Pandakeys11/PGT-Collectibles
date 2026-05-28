/**
 * Resolve Pokémon catalog IDs from API ids (`me4-122`) or collector shorthand (`me4-122/086`).
 */

export type ParsedCatalogSku =
  | { kind: "catalog_id"; catalogId: string }
  | { kind: "set_number"; setCode: string; cardNumber: string };

const CATALOG_ID_RE = /^[a-z0-9]{2,}-[a-z0-9]+(?:__[\w-]+)?$/i;
const SET_NUMBER_RE = /^([a-z0-9]{2,})-(\d+)(?:\/\d+)?$/i;

export function parsePokemonCatalogSku(input: string): ParsedCatalogSku | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (CATALOG_ID_RE.test(trimmed)) {
    return { kind: "catalog_id", catalogId: trimmed };
  }

  const m = trimmed.match(SET_NUMBER_RE);
  if (m) {
    return {
      kind: "set_number",
      setCode: m[1].toLowerCase(),
      cardNumber: m[2].replace(/^0+/, "") || m[2],
    };
  }

  return null;
}

/** Canonical `catalog_id` for DB lookup (set_code + number → `me4-122`). */
export function pokemonCatalogIdFromSku(input: string): string | null {
  const parsed = parsePokemonCatalogSku(input);
  if (!parsed) return null;
  if (parsed.kind === "catalog_id") return parsed.catalogId;
  return `${parsed.setCode}-${parsed.cardNumber}`;
}

export function formatPokemonCatalogSkuLabel(catalogId: string, cardNumber?: string | null): string {
  const parts = catalogId.split("-");
  if (parts.length < 2) return catalogId;
  const setCode = parts[0];
  const num = cardNumber?.replace(/^#/, "").trim() || parts.slice(1).join("-").replace(/__.*$/, "");
  return `${setCode}-${num}`;
}
