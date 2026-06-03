import { parseCollectorFraction } from "@/lib/scan/collector-fraction";
import { promoSetNamesMatch } from "@/lib/scan/promo-set-aliases";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

/** Catalogued English set candidate for a printed collector denominator. */
export type SetCandidate = {
  name: string;
  year?: string;
  symbolNote?: string;
};

export type DenominatorRule = {
  printedTotal: number;
  candidates: SetCandidate[];
};

/** Promo / specialty collector codes (not always n/N fractions). */
export type PromoNumberRule = {
  label: string;
  example: string;
  setName: string;
  patternNote: string;
};

/** Single-set denominators — safe for batch coercion when the page agrees on /N. */
export const UNIQUE_DENOMINATOR_RULES: DenominatorRule[] = [
  {
    printedTotal: 18,
    candidates: [
      {
        name: "Southern Islands",
        year: "2001",
        symbolNote: "palm-tree island",
      },
    ],
  },
  {
    printedTotal: 62,
    candidates: [{ name: "Fossil", year: "1999", symbolNote: "fossil logo" }],
  },
  { printedTotal: 75, candidates: [{ name: "Neo Discovery", year: "2001" }] },
  {
    printedTotal: 82,
    candidates: [
      {
        name: "Team Rocket",
        year: "2000",
        symbolNote: "black R — not /102 Base",
      },
    ],
  },
  { printedTotal: 105, candidates: [{ name: "Neo Destiny", year: "2002" }] },
  {
    printedTotal: 111,
    candidates: [
      { name: "Neo Genesis", year: "2000", symbolNote: "Neo star — not /102" },
    ],
  },
  /** Wizards Base Set (102). Base Set 2 is always /130 — never map /102 to Base Set 2. */
  {
    printedTotal: 102,
    candidates: [
      {
        name: "Base Set",
        year: "1999",
        symbolNote: "plain symbol; not Team Rocket /82",
      },
    ],
  },
  {
    printedTotal: 110,
    candidates: [
      {
        name: "Legendary Collection",
        year: "2002",
        symbolNote: "LC flame logo — reverse holo reprints; not Base /102",
      },
    ],
  },
  {
    printedTotal: 112,
    candidates: [
      {
        name: "Evolutions",
        year: "2016",
        symbolNote: "retro XY reprints — not Wizards /102",
      },
    ],
  },
  {
    printedTotal: 130,
    candidates: [
      {
        name: "Base Set 2",
        year: "2000",
        symbolNote: "Poké Ball + 2 — not /102",
      },
    ],
  },
  {
    printedTotal: 165,
    candidates: [{ name: "Expedition Base Set", year: "2002" }],
  },
  { printedTotal: 182, candidates: [{ name: "Aquapolis", year: "2003" }] },
  { printedTotal: 144, candidates: [{ name: "Skyridge", year: "2003" }] },
  {
    printedTotal: 106,
    candidates: [{ name: "EX Ruby & Sapphire", year: "2003" }],
  },
  { printedTotal: 97, candidates: [{ name: "Dragon", year: "2003" }] },
  {
    printedTotal: 100,
    candidates: [{ name: "Crystal Guardians", year: "2006" }],
  },
  { printedTotal: 116, candidates: [{ name: "Plasma Storm", year: "2013" }] },
  {
    printedTotal: 160,
    candidates: [{ name: "Prismatic Evolutions", year: "2025" }],
  },
];

/** Shared denominators — vision must use set symbol + title; never guess from neighbors. */
export const SHARED_DENOMINATOR_RULES: DenominatorRule[] = [
  {
    printedTotal: 64,
    candidates: [
      { name: "Jungle", year: "1999", symbolNote: "Jungle logo" },
      { name: "Fossil", year: "1999", symbolNote: "Fossil logo" },
      { name: "Neo Revelation", year: "2001" },
    ],
  },
  {
    printedTotal: 132,
    candidates: [
      { name: "Gym Heroes", year: "2000", symbolNote: "Gym Heroes logo" },
      {
        name: "Gym Challenge",
        year: "2000",
        symbolNote: "Gym Challenge logo (e.g. Blaine's Charizard)",
      },
    ],
  },
];

export const ALL_DENOMINATOR_RULES: DenominatorRule[] = [
  ...UNIQUE_DENOMINATOR_RULES,
  ...SHARED_DENOMINATOR_RULES,
];

export const PROMO_NUMBER_RULES: PromoNumberRule[] = [
  {
    label: "Scarlet & Violet promos",
    example: "SVP045",
    setName: "Scarlet & Violet Promos",
    patternNote: "SVP + digits — catalog set name (not Black Star in API)",
  },
  {
    label: "Sword & Shield promos",
    example: "SWSH198",
    setName: "Sword & Shield Promos",
    patternNote: "SWSH prefix + digits",
  },
  {
    label: "Sun & Moon promos",
    example: "SM245",
    setName: "Sun & Moon Promos",
    patternNote: "SM prefix + digits",
  },
  {
    label: "XY promos",
    example: "XY188",
    setName: "XY Black Star Promos",
    patternNote: "XY prefix",
  },
  {
    label: "Black & White promos",
    example: "BW101",
    setName: "BW Black Star Promos",
    patternNote: "BW prefix",
  },
  {
    label: "HGSS promos",
    example: "HGSS01",
    setName: "HGSS Black Star Promos",
    patternNote: "HGSS prefix",
  },
  {
    label: "Diamond & Pearl promos",
    example: "DP47",
    setName: "Diamond & Pearl Promos",
    patternNote: "DP prefix",
  },
  {
    label: "Wizards black star",
    example: "1",
    setName: "Wizards Black Star Promos",
    patternNote: "Wizards-era black star (set basep); numeric 1–53",
  },
  {
    label: "Nintendo black star",
    example: "NP35",
    setName: "Nintendo Black Star Promos",
    patternNote: "NP prefix (set np)",
  },
  {
    label: "Radiant Collection",
    example: "RC12",
    setName: "Legendary Treasures",
    patternNote: "RC prefix inside set",
  },
  {
    label: "Trainer Gallery",
    example: "TG15",
    setName: "trainer gallery subset",
    patternNote: "TG prefix — pair with parent set in set field when visible",
  },
];

const DENOMINATOR_BY_TOTAL = new Map(
  ALL_DENOMINATOR_RULES.map((r) => [r.printedTotal, r]),
);

const EDITION_ONLY_SET =
  /^(1st\s*edition|first\s*edition|shadowless|unlimited|holo|reverse|promo)$/i;

export function isEditionOnlySetName(set: string | undefined): boolean {
  return EDITION_ONLY_SET.test((set ?? "").trim());
}

export function ruleForPrintedTotal(
  total: number,
): DenominatorRule | undefined {
  return DENOMINATOR_BY_TOTAL.get(total);
}

export function uniqueCandidateForTotal(
  total: number,
): SetCandidate | undefined {
  const rule = ruleForPrintedTotal(total);
  return rule?.candidates.length === 1 ? rule.candidates[0] : undefined;
}

export function normalizeSetNameForMatch(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function setNamesMatch(
  a: string | undefined,
  b: string | undefined,
): boolean {
  return promoSetNamesMatch(a, b);
}

export function catalogHitMatchesPrintedTotal(
  hit: { set?: { printedTotal?: number; total?: number } },
  printedTotal: number,
): boolean {
  const pt = hit.set?.printedTotal;
  const tot = hit.set?.total;
  return pt === printedTotal || tot === printedTotal;
}

export function cardHasCollectorFraction(
  card: Pick<ExtractedCard, "number">,
): boolean {
  return Boolean(parseCollectorFraction(card.number));
}

/** Strong identity: full fraction and/or a real set name (not edition-only). */
export function hasStrongSetHint(
  card: Pick<ExtractedCard, "set" | "number">,
): boolean {
  const frac = parseCollectorFraction(card.number);
  if (frac) return true;
  const set = (card.set ?? "").trim();
  return Boolean(set) && !isEditionOnlySetName(set);
}

export function printedTotalHint(
  card: Pick<ExtractedCard, "set" | "number">,
): number | undefined {
  const frac = parseCollectorFraction(card.number);
  if (frac) return frac.den;
  return undefined;
}

export function catalogHitMatchesCardHint(
  hit: { set?: { name?: string; printedTotal?: number; total?: number } },
  card: Pick<ExtractedCard, "set" | "number">,
): boolean {
  const den = printedTotalHint(card);
  if (den != null && !catalogHitMatchesPrintedTotal(hit, den)) return false;
  const setHint = (card.set ?? "").trim();
  if (setHint && !isEditionOnlySetName(setHint)) {
    return setNamesMatch(hit.set?.name, setHint);
  }
  return true;
}

/**
 * Correct common Wizards-era vision errors: /82 misread as /102 (Team Rocket vs Base),
 * Gym owner's cards misread as /102 instead of /132,
 * Base Set /102 misread as /130 (Base Set 2).
 */
export function correctBaseSetVersusBaseSet2FractionOcr(
  card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "printStamps" | "details">,
): { number?: string; set?: string; year?: string; details?: string } {
  const frac = parseCollectorFraction(card.number);
  const setTrim = (card.set ?? "").trim();
  const detailsTrim = (card.details ?? "").trim();
  const blob = [card.year, card.printStamps, card.details, card.set, card.name]
    .filter(Boolean)
    .join(" ");

  if (frac?.den === 102 && /\bbase\s*set\s*2\b/i.test(setTrim)) {
    return {
      set: "Base Set",
      year: card.year?.trim() || "1999",
      details: appendSetOcrNote(
        detailsTrim,
        "Auto-correct: /102 is Base Set — Base Set 2 prints use /130 only.",
      ),
    };
  }

  if (frac?.den !== 130) return {};

  if (/\bbase\s*set\s*2\b/i.test(setTrim)) return {};

  const wizardsBaseSignals =
    (/\bbase\s*set\b/i.test(setTrim) && !/\bbase\s*set\s*2\b/i.test(setTrim)) ||
    /\b1999\b/.test(blob) ||
    /\b(shadowless|1st\s*ed(?:ition)?|unlimited)\b/i.test(blob) ||
    /\b(drop\s*shadow|no\s*drop\s*shadow|shadow\s*on\s*art)\b/i.test(blob);

  if (!wizardsBaseSignals) return {};

  const numer = frac.num.replace(/^0+/, "") || frac.num;
  return {
    number: `${numer}/102`,
    set: setTrim && /\bbase\s*set\b/i.test(setTrim) ? "Base Set" : setTrim || "Base Set",
    year: card.year?.trim() || "1999",
    details: appendSetOcrNote(
      detailsTrim,
      "Auto-correct: /130 is Base Set 2 only — Wizards Base Set is /102 (common 102↔130 OCR on vintage holos).",
    ),
  };
}

function appendSetOcrNote(details: string, note: string): string {
  return [details, note].filter(Boolean).join(" ┃ ");
}

export function applyWizardsTitleAndFractionHeuristics(
  name: string | undefined,
  set: string | undefined,
  number: string | undefined,
  details: string | undefined,
  extras?: Pick<ExtractedCard, "year" | "printStamps">,
): { set?: string; number?: string; details?: string; clearSet?: boolean; year?: string } {
  const baseSetOcr = correctBaseSetVersusBaseSet2FractionOcr({
    name,
    set,
    number,
    year: extras?.year,
    printStamps: extras?.printStamps,
    details,
  });
  const numAfterBase = baseSetOcr.number ?? number;
  const setAfterBase = baseSetOcr.set ?? set;
  const detAfterBase = baseSetOcr.details ?? details;
  const yearAfterBase = baseSetOcr.year;

  const nameTrim = name?.trim() ?? "";
  const setTrim = setAfterBase?.trim() ?? "";
  const numTrim = numAfterBase?.trim() ?? "";
  const detTrim = detAfterBase?.trim() ?? "";

  const frac102 = numTrim.match(/^#?\s*(\d+)\s*\/\s*102\s*$/i);
  if (!frac102) {
    if (baseSetOcr.number || baseSetOcr.set || baseSetOcr.details) {
      return {
        number: numAfterBase,
        set: setAfterBase,
        details: detAfterBase,
        year: yearAfterBase,
      };
    }
    return {};
  }

  const numer = frac102[1]!;

  const isDarkPokemonTitle =
    /^dark(\s+\S|$)/i.test(nameTrim) || /^dark$/i.test(nameTrim);
  const setHintsRocket =
    /\b(team\s*)?rocket\b|\bdark\s*champ|\brocket\s*champ/i.test(setTrim);

  if (isDarkPokemonTitle || setHintsRocket) {
    const note =
      "Auto-correct: Dark Pokémon + /102 → Team Rocket /82 (common 82↔102 OCR).";
    return {
      number: `${numer}/82`,
      set: /team\s*rocket/i.test(setTrim) ? setAfterBase : "Team Rocket",
      details: [detTrim, note].filter(Boolean).join(" ┃ "),
    };
  }

  const gymOwners =
    /^(Blaine|Blair|Brock|Erika|Giovanni|Koga|Lt\.?\s*Surge|Misty|Rocket's|Sabrina|Bugsy|Chuck|Pryce|Jasmine|Clair)'?s\b/i.test(
      nameTrim,
    );

  if (gymOwners) {
    const note =
      "Auto-correct: Gym owner's Pokémon + /102 → /132 (Gym Heroes or Challenge) — confirm with symbol.";
    if (/\b(heroes|challenge|gym)\b/i.test(setTrim)) {
      return {
        number: `${numer}/132`,
        details: [detTrim, note].filter(Boolean).join(" ┃ "),
      };
    }
    return {
      number: `${numer}/132`,
      clearSet: true,
      details: [detTrim, note].filter(Boolean).join(" ┃ "),
    };
  }

  if (baseSetOcr.number || baseSetOcr.set || baseSetOcr.details) {
    return {
      number: numAfterBase,
      set: setAfterBase,
      details: detAfterBase,
      year: yearAfterBase,
    };
  }

  return {};
}

/** Per-card: infer set/year from unique denominators and specialty fractions. */
export function applySetFromCollectorFraction(
  set: string | undefined,
  number: string | undefined,
  details: string | undefined,
): { set?: string; details?: string; year?: string } {
  const frac = parseCollectorFraction(number);
  if (!frac) return { set, details };

  const unique = uniqueCandidateForTotal(frac.den);
  const setTrim = (set ?? "").trim();
  const detailsStr = (details ?? "").trim();
  const mentionsCandidate =
    unique &&
    (setNamesMatch(setTrim, unique.name) ||
      new RegExp(unique.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
        detailsStr,
      ));

  if (unique) {
    const editionOnly = isEditionOnlySetName(setTrim);
    if (!setTrim || editionOnly || mentionsCandidate) {
      const mergedDetails = editionOnly
        ? [setTrim, detailsStr].filter(Boolean).join(" · ")
        : detailsStr;
      return {
        set:
          mentionsCandidate && !editionOnly
            ? setTrim || unique.name
            : unique.name,
        details: mergedDetails || undefined,
        year: unique.year,
      };
    }
    if (mentionsCandidate) {
      return {
        set: setTrim || unique.name,
        details: detailsStr || undefined,
        year: unique.year,
      };
    }

    /** One English main set per /N — hallucinated set names (e.g. "Dark Champions") lose to the fraction. */
    if (!editionOnly && setTrim && !setNamesMatch(setTrim, unique.name)) {
      const note = `Auto-correct: /${frac.den} → ${unique.name} (vision set "${setTrim}" invalid for this denominator).`;
      return {
        set: unique.name,
        details: [detailsStr, note].filter(Boolean).join(" ┃ "),
        year: unique.year,
      };
    }
  }

  const sl = setTrim.toLowerCase();
  const contradicts =
    (frac.den === 111 && (sl === "jungle" || sl === "fossil")) ||
    (frac.den === 82 && sl === "jungle") ||
    (frac.den > 64 && (sl === "jungle" || sl === "fossil")) ||
    /** Base Set misread for larger Neo / Rocket / Base 2 fractions */
    (frac.den === 82 &&
      /\bbase\s*set\b/i.test(sl) &&
      !/\bbase\s*set\s*2\b/i.test(sl)) ||
    (frac.den === 111 && /\bbase\b/i.test(sl) && !/\bneo\b/i.test(sl)) ||
    (frac.den === 130 &&
      /\bbase\s*set\b/i.test(sl) &&
      !/\b2\b/.test(sl) &&
      !/\bbase\s*set\s*2\b/i.test(sl)) ||
    (frac.den === 110 &&
      /\bbase\s*set\b/i.test(sl) &&
      !/\blegendary\s*collection\b/i.test(sl)) ||
    (frac.den === 112 &&
      /\b(base\s*set|jungle|fossil|team\s*rocket)\b/i.test(sl) &&
      !/\bevolutions\b/i.test(sl)) ||
    (frac.den === 132 && /\bbase\b/i.test(sl) && !/\bgym\b/i.test(sl));

  if (contradicts && unique) {
    return {
      set: unique.name,
      details: detailsStr || undefined,
      year: unique.year,
    };
  }

  if (!setTrim || sl === "unknown") {
    const candidate = uniqueCandidateForTotal(frac.den);
    if (candidate) {
      return {
        set: candidate.name,
        details: detailsStr || undefined,
        year: candidate.year,
      };
    }
  }

  if (
    frac.den === 132 &&
    /\bbase\b/i.test(sl) &&
    !/\bgym\b/i.test(sl) &&
    !/\bheroes\b/i.test(sl) &&
    !/\bchallenge\b/i.test(sl)
  ) {
    return {
      set: undefined,
      details: [
        detailsStr,
        "Corrected: /132 is Gym Heroes or Gym Challenge — pick set from symbol.",
      ]
        .filter(Boolean)
        .join(" ┃ "),
    };
  }

  return { set, details };
}

export function captureConsensusThreshold(groupSize: number): number {
  if (groupSize <= 0) return Number.POSITIVE_INFINITY;
  if (groupSize >= 16) {
    return Math.ceil(groupSize * 0.75);
  }
  return Math.min(12, Math.max(6, Math.ceil(groupSize * (2 / 3))));
}

export type CaptureSetConsensus = {
  setName: string;
  year?: string;
  printedTotal?: number;
};

function countByKey<T>(
  items: T[],
  keyFn: (item: T) => string | null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/** Detect uniform set or unique denominator across a binder capture. */
export function detectCaptureSetConsensus(
  cards: ExtractedCard[],
): CaptureSetConsensus | null {
  if (cards.length === 0) return null;
  const threshold = captureConsensusThreshold(cards.length);

  const denCounts = countByKey(cards, (c) => {
    const den = parseCollectorFraction(c.number)?.den;
    return den != null ? String(den) : null;
  });

  let bestDen: number | null = null;
  let bestDenCount = 0;
  denCounts.forEach((count, denStr) => {
    if (count > bestDenCount) {
      bestDenCount = count;
      bestDen = Number(denStr);
    }
  });

  if (bestDen != null && bestDenCount >= threshold) {
    const unique = uniqueCandidateForTotal(bestDen);
    if (unique) {
      return { setName: unique.name, year: unique.year, printedTotal: bestDen };
    }
  }

  const setCounts = countByKey(cards, (c) => {
    const s = (c.set ?? "").trim();
    if (!s || isEditionOnlySetName(s)) return null;
    return normalizeSetNameForMatch(s);
  });

  let bestSet: string | null = null;
  let bestSetCount = 0;
  setCounts.forEach((count, setKey) => {
    if (count > bestSetCount) {
      bestSetCount = count;
      const sample = cards.find(
        (c) => normalizeSetNameForMatch(c.set) === setKey,
      );
      bestSet = sample?.set?.trim() ?? null;
    }
  });

  if (bestSet != null && bestSet !== "" && bestSetCount >= threshold) {
    const consensusSet = bestSet;
    const den = parseCollectorFraction(
      cards.find((c) => setNamesMatch(c.set, consensusSet))?.number,
    )?.den;
    const unique = den != null ? uniqueCandidateForTotal(den) : undefined;
    return {
      setName: consensusSet,
      year:
        unique?.year ??
        cards.find((c) => setNamesMatch(c.set, consensusSet))?.year?.trim(),
      printedTotal: den,
    };
  }

  return null;
}

export function shouldCoerceCaptureSetConsensus(
  cards: ExtractedCard[],
): boolean {
  return detectCaptureSetConsensus(cards) != null;
}

/** Apply page-level set consensus to rows missing set or showing edition-only set. */
export function coerceCaptureSetConsensus(
  cards: ExtractedCard[],
): ExtractedCard[] {
  const consensus = detectCaptureSetConsensus(cards);
  if (!consensus) return cards;

  return cards.map((card) => {
    const setTrim = (card.set ?? "").trim();
    const needsSet = !setTrim || isEditionOnlySetName(setTrim);
    const contradicts =
      consensus.printedTotal != null &&
      parseCollectorFraction(card.number)?.den != null &&
      parseCollectorFraction(card.number)!.den !== consensus.printedTotal;

    if (!needsSet && !contradicts) {
      if (consensus.year && !card.year?.trim()) {
        return extractedCardSchema.parse({ ...card, year: consensus.year });
      }
      return card;
    }

    if (contradicts) return card;

    const editionOnly = isEditionOnlySetName(setTrim);
    const detailsParts = [
      editionOnly ? setTrim : null,
      card.details?.trim(),
    ].filter(Boolean);
    return extractedCardSchema.parse({
      ...card,
      set: consensus.setName,
      year: card.year?.trim() || consensus.year,
      details: detailsParts.length ? detailsParts.join(" · ") : card.details,
    });
  });
}

function formatDenominatorLine(rule: DenominatorRule): string {
  if (rule.candidates.length === 1) {
    const c = rule.candidates[0]!;
    const year = c.year ? ` (${c.year})` : "";
    const sym = c.symbolNote ? `; ${c.symbolNote}` : "";
    return `  - /${rule.printedTotal} → **${c.name}**${year}${sym}`;
  }
  const names = rule.candidates.map((c) => c.name).join(" OR ");
  const symbols = rule.candidates
    .map((c) => (c.symbolNote ? `${c.name}: ${c.symbolNote}` : c.name))
    .join("; ");
  return `  - /${rule.printedTotal} → **${names}** — read set symbol: ${symbols}`;
}

/** Shared vision instructions for set + collector number (binder + single-card). */
export function buildVisionSetIdentificationBlock(): string {
  const uniqueLines = UNIQUE_DENOMINATOR_RULES.map(formatDenominatorLine).join(
    "\n",
  );
  const sharedLines = SHARED_DENOMINATOR_RULES.map(formatDenominatorLine).join(
    "\n",
  );
  const promoLines = PROMO_NUMBER_RULES.map(
    (p) => `  - ${p.example} → ${p.setName} (${p.patternNote})`,
  ).join("\n");

  return `- **Set identification (critical):** Each card is identified independently. Never copy set from a neighbor; read the symbol + fraction on **that** card.
- Read the **set symbol** beside the collector number (bottom-right of the art on Wizards cards). The **denominator** is decisive: **/82 ≠ /102 ≠ /130** — read the tens digit carefully (glare often drops an 8).
- **Wizards-era (do not conflate):**
  - **/18** = **Southern Islands** (2001 boutique sheet): **palm-tree on a tiny island** set symbol — **not** Base, Jungle, Fossil, or Neo even if the Pokémon appears there. **Never** substitute Neo Genesis **/111**, Fossil **/62**, Jungle **/64**, or a bare Wizards number; read **/18** and **Southern Islands**.
  - **/82** = **Team Rocket** (black **R**). **Dark** Pokémon (e.g. Dark Charizard) use **/82**, not Base /102.
  - **/102** = **Base Set** (1999) — e.g. non-Dark Charizard; **German “Glurak”** may be Base /102.
  - **/110** = **Legendary Collection** (2002) — Wizards reprints; **reverse holo** foil on the image border; **not** Base /102.
  - **/112** = **Evolutions** (2016) — classic art reprints with modern card frame; **not** Wizards /102.
  - **/130** = **Base Set 2** (Poké Ball + **“2”**) — **never** use /102 for Base Set 2.
  - **/111** Neo Genesis; **/105** Neo Destiny; **/75** Neo Discovery.
  - **/132** = **Gym Heroes** or **Gym Challenge** — **Blaine's / Brock's / …** use gym building symbol (not Base Set).
- **Full card names:** e.g. **Dark Charizard**, **Blaine's Charizard** — not truncated “Dark”. Put language in **language** and the exact visible title in **printedName**.
- **Unique denominators (one English main set per total):**
${uniqueLines}
- **Shared denominators (symbol + title required):**
${sharedLines}
- **Promo / specialty codes** (full code in number; set = catalog promo name):
${promoLines}
- **number** = printed collector only — full fractions, promos (SVP 045), subsets (TG15). Never Pokédex #.
- Never put edition or language in number — use printStamps/language/printedName/details.
- **set** = English catalog name — not “1st Edition” alone.
- If symbol + fraction disagree with your guess, trust the print. If illegible, **Unknown** + symbol note in details — **do not** default the whole page to Base Set.
- **year** = copyright when visible; must not contradict the set.`;
}

// --- Southern Islands (re-export compat) ---
export const SOUTHERN_ISLANDS_SET = "Southern Islands";
export const SOUTHERN_ISLANDS_YEAR = "2001";
export const SOUTHERN_ISLANDS_PRINTED_TOTAL = 18;

/**
 * Official English Southern Islands checklist order (collector 1/18 … 18/18).
 * Used to recover identity when vision misreads /18 as Base/Jungle/Fossil/Neo fractions.
 */
export const SOUTHERN_ISLANDS_ORDERED_NAMES = [
  "Mew",
  "Pidgeot",
  "Onix",
  "Togepi",
  "Ivysaur",
  "Raticate",
  "Ledyba",
  "Jigglypuff",
  "Butterfree",
  "Tentacruel",
  "Marill",
  "Lapras",
  "Exeggutor",
  "Slowking",
  "Wartortle",
  "Lickitung",
  "Vileplume",
  "Primeape",
] as const;

function normalizePokemonNameForSouthernIslandsRoster(
  name: string | undefined,
): string | null {
  if (!name?.trim()) return null;
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Map a vision name to Southern Islands collector index (1–18), or null if not in the set. */
export function southernIslandsRosterIndexForName(
  name: string | undefined,
): number | null {
  const n = normalizePokemonNameForSouthernIslandsRoster(name);
  if (!n) return null;
  const idx = SOUTHERN_ISLANDS_ORDERED_NAMES.findIndex(
    (species) => normalizePokemonNameForSouthernIslandsRoster(species) === n,
  );
  return idx >= 0 ? idx + 1 : null;
}

function distinctFractionDenominators(cards: ExtractedCard[]): Set<number> {
  const s = new Set<number>();
  for (const c of cards) {
    const d = parseCollectorFraction(c.number)?.den;
    if (d != null) s.add(d);
  }
  return s;
}

function distinctCatalogLikeSetKeys(cards: ExtractedCard[]): Set<string> {
  const s = new Set<string>();
  for (const c of cards) {
    const raw = (c.set ?? "").trim();
    if (!raw || isEditionOnlySetName(raw)) continue;
    s.add(normalizeSetNameForMatch(raw));
  }
  return s;
}

/**
 * True when the sheet looks like a **misread Southern Islands page**: many different “sets” or
 * denominators from the same era (vision conflated palm-tree /18 with Base / Neo / Jungle).
 */
export function batchLooksLikeSouthernIslandsVisionConfusion(
  cards: ExtractedCard[],
): boolean {
  if (cards.length < 6) return false;
  const setKeys = distinctCatalogLikeSetKeys(cards);
  const dens = distinctFractionDenominators(cards);
  if (setKeys.size >= 3 || dens.size >= 3) return true;
  const n = cards.length;
  const rosterHits = cards.reduce(
    (acc, c) =>
      acc + (southernIslandsRosterIndexForName(c.name) != null ? 1 : 0),
    0,
  );
  if (n >= 12 && rosterHits >= Math.ceil(n * 0.85)) return true;
  if (n >= 16 && rosterHits >= n - 1) return true;
  if (n === 18 && rosterHits >= 14) return true;
  return false;
}

const SOUTHERN_ISLANDS_AUTO_NOTE =
  "Set corrected to Southern Islands (18-card roster).";

function batchMajorityGradedSlabs(cards: ExtractedCard[]): boolean {
  if (cards.length === 0) return false;
  const graded = cards.filter((c) => {
    if (c.visionLane === "graded" || c.encapsulation === "graded_slab") return true;
    const blob = `${c.grader ?? ""} ${c.grade ?? ""} ${c.labelTitle ?? ""} ${c.details ?? ""}`;
    return /\b(PSA|CGC|BGS|BVG|SGC)\b/i.test(blob);
  }).length;
  return graded >= Math.ceil(cards.length * 0.5);
}

export function shouldCoerceSouthernIslandsByRoster(
  cards: ExtractedCard[],
): boolean {
  if (cards.length < 6) return false;
  if (batchMajorityGradedSlabs(cards)) return false;
  const rosterHits = cards.filter(
    (c) => southernIslandsRosterIndexForName(c.name) != null,
  ).length;
  if (rosterHits < Math.max(6, Math.ceil(cards.length * 0.65))) return false;
  return batchLooksLikeSouthernIslandsVisionConfusion(cards);
}

/** Rewrite matching rows to Southern Islands N/18 when the batch clearly isn’t one coherent classic set. */
export function coerceSouthernIslandsByRoster(
  cards: ExtractedCard[],
): ExtractedCard[] {
  if (!shouldCoerceSouthernIslandsByRoster(cards)) return cards;

  return cards.map((card) => {
    const idx = southernIslandsRosterIndexForName(card.name);
    if (idx == null) return card;

    const det = card.details?.trim() ?? "";
    const mergedDetails = det.includes(SOUTHERN_ISLANDS_AUTO_NOTE)
      ? det
      : [det, SOUTHERN_ISLANDS_AUTO_NOTE].filter(Boolean).join(" · ");

    return extractedCardSchema.parse({
      ...card,
      set: SOUTHERN_ISLANDS_SET,
      number: `${idx}/18`,
      year: card.year?.trim() || SOUTHERN_ISLANDS_YEAR,
      details: mergedDetails || SOUTHERN_ISLANDS_AUTO_NOTE,
    });
  });
}

export function southernIslandsSignal(
  card: Pick<ExtractedCard, "set" | "number" | "details">,
): boolean {
  const den = parseCollectorFraction(card.number)?.den;
  if (den === SOUTHERN_ISLANDS_PRINTED_TOTAL) return true;
  if (
    /\bsouthern\s*islands?\b/i.test(`${card.set ?? ""} ${card.details ?? ""}`)
  )
    return true;
  if (
    /palm[-\s]?tree|island\s*symbol|southern\s*island\s*promo/i.test(
      card.details ?? "",
    )
  )
    return true;
  return false;
}

export function southernIslandsHint(
  card: Pick<ExtractedCard, "set" | "number">,
): boolean {
  if (setNamesMatch(card.set, SOUTHERN_ISLANDS_SET)) return true;
  return (
    parseCollectorFraction(card.number)?.den === SOUTHERN_ISLANDS_PRINTED_TOTAL
  );
}

export function catalogHitIsSouthernIslands(hit: {
  set?: { name?: string; printedTotal?: number; total?: number };
}): boolean {
  if (/\bsouthern\s*islands?\b/i.test(hit.set?.name ?? "")) return true;
  return catalogHitMatchesPrintedTotal(hit, SOUTHERN_ISLANDS_PRINTED_TOTAL);
}
