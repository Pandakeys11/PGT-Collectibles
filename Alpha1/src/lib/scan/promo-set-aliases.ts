import promoRows from "@/data/pokedex/catalog-promo-special-sets.json";

function normalizeSetNameForMatch(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function baseSetNamesMatch(a: string | undefined, b: string | undefined): boolean {
  const x = normalizeSetNameForMatch(a);
  const y = normalizeSetNameForMatch(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

type PromoRow = { setId: string; name: string; bucket: string };

const PROMO_BY_ID = new Map<string, PromoRow>();
for (const row of promoRows as PromoRow[]) {
  if (row.bucket === "promo") PROMO_BY_ID.set(row.setId.trim().toLowerCase(), row);
}

/** Printed collector prefix → pokemontcg.io set id */
const NUMBER_PREFIX_TO_SET_ID: Record<string, string> = {
  SVP: "svp",
  SWSH: "swshp",
  SM: "smp",
  XY: "xyp",
  BW: "bwp",
  HGSS: "hsp",
  DP: "dpp",
  NP: "np",
};

type PromoAlias = { setId: string; apiName: string; patterns: RegExp[] };

const PROMO_ALIASES: PromoAlias[] = [
  ...Array.from(PROMO_BY_ID.values()).map((row) => ({
    setId: row.setId,
    apiName: row.name,
    patterns: [
      new RegExp(row.setId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      new RegExp(row.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    ],
  })),
  {
    setId: "svp",
    apiName: "Scarlet & Violet Promos",
    patterns: [/scarlet\s*&?\s*violet\s*black\s*star/i, /\bsvp\b/i],
  },
  {
    setId: "swshp",
    apiName: "Sword & Shield Promos",
    patterns: [/swsh\s*black\s*star/i, /\bswshp?\b/i],
  },
  {
    setId: "smp",
    apiName: "Sun & Moon Promos",
    patterns: [/sm\s*black\s*star/i, /sun\s*&?\s*moon\s*promo/i],
  },
  {
    setId: "xyp",
    apiName: "XY Black Star Promos",
    patterns: [/xy\s*black\s*star/i],
  },
  {
    setId: "bwp",
    apiName: "BW Black Star Promos",
    patterns: [/bw\s*black\s*star/i],
  },
  {
    setId: "hsp",
    apiName: "HGSS Black Star Promos",
    patterns: [/hgss\s*black\s*star/i],
  },
  {
    setId: "dpp",
    apiName: "Diamond & Pearl Promos",
    patterns: [/diamond\s*&?\s*pearl\s*(black\s*star\s*)?promo/i],
  },
  {
    setId: "basep",
    apiName: "Wizards Black Star Promos",
    patterns: [/wizards\s*black\s*star/i, /\bbasep\b/i],
  },
  {
    setId: "np",
    apiName: "Nintendo Black Star Promos",
    patterns: [/nintendo\s*black\s*star/i],
  },
];

export type ResolvedPromoSet = { setId: string; apiName: string };

export function resolvePokemonPromoSet(
  hint: string | undefined,
): ResolvedPromoSet | null {
  const text = (hint ?? "").trim();
  if (!text) return null;

  for (const alias of PROMO_ALIASES) {
    if (alias.patterns.some((p) => p.test(text))) {
      return { setId: alias.setId, apiName: alias.apiName };
    }
  }

  const norm = normalizeSetNameForMatch(text);
  for (const row of PROMO_BY_ID.values()) {
    const rowNorm = normalizeSetNameForMatch(row.name);
    if (norm === rowNorm || norm.includes(rowNorm) || rowNorm.includes(norm)) {
      return { setId: row.setId, apiName: row.name };
    }
  }
  return null;
}

export function promoSetNamesMatch(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (baseSetNamesMatch(a, b)) return true;
  const ra = resolvePokemonPromoSet(a);
  const rb = resolvePokemonPromoSet(b);
  if (ra && rb) return ra.setId === rb.setId;
  if (ra && b) return baseSetNamesMatch(ra.apiName, b);
  if (rb && a) return baseSetNamesMatch(rb.apiName, a);
  return false;
}

const PROMO_NUMBER_RE =
  /^(SVP|SWSH|SM|XY|BW|HGSS|DP|NP)\s*#?\s*(\d{1,4}[a-z]?)$/i;

/** Infer promo set + canonical collector code (e.g. SM245) from slab label or vision. */
export function normalizePromoCardIdentity(input: {
  set?: string;
  number?: string;
}): { set?: string; number?: string } {
  const setIn = input.set?.trim();
  let number = input.number?.trim();
  if (!number) return { set: setIn, number };

  const codeMatch = number.match(PROMO_NUMBER_RE);
  if (codeMatch) {
    const prefix = codeMatch[1]!.toUpperCase();
    const digits = codeMatch[2]!;
    const setId = NUMBER_PREFIX_TO_SET_ID[prefix];
    const row = setId ? PROMO_BY_ID.get(setId) : undefined;
    const canonicalNumber = `${prefix}${digits}`;
    return {
      set: setIn || row?.name,
      number: canonicalNumber,
    };
  }

  const resolved = resolvePokemonPromoSet(setIn);
  if (resolved && /^\d{1,4}[a-z]?$/i.test(number)) {
    const prefix =
      Object.entries(NUMBER_PREFIX_TO_SET_ID).find(([, id]) => id === resolved.setId)?.[0] ??
      null;
    if (prefix) {
      number = `${prefix}${number.replace(/^#/, "")}`;
    }
  }

  return { set: setIn, number };
}

export function canonicalPromoSetName(setHint: string | undefined): string | undefined {
  const resolved = resolvePokemonPromoSet(setHint);
  return resolved?.apiName ?? (setHint?.trim() || undefined);
}
