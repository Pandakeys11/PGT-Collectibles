import type { ExtractedCard } from "@/lib/scan/schemas";

const GRADER_PATTERN = /\b(PSA|CGC|BGS|BVG|SGC|ACE|TAG|HGA|GMA)\b/i;

const PROMO_OR_SET_CODE =
  /\b(SM|SWSH|SVP?|TG|GG|BW|XY|DP|PL|HGSS|OP|ST|EB)\s*[-#]?\s*(\d{1,4})\b/i;

const TCG_SET_KEYWORDS =
  /\b(POKEMON|POKÉMON|P\.?\s*M\.?|ONE\s*PIECE|YUGIOH|YU-GI-OH|MAGIC|LORCANA|DRAGON\s*BALL)\b/i;

/** Split multi-line / multi-segment slab label blobs. */
export function splitSlabLabelLines(text: string | undefined | null): string[] {
  const raw = text?.trim();
  if (!raw) return [];
  return raw
    .split(/[\n\r]+|(?:\s+·\s+)|(?:\s*\|\s*)/)
    .map((line) => line.trim())
    .filter((line) => line.length > 1);
}

/** Combine labelTitle + details + grade line for parsing. */
export function combineSlabLabelSources(
  ...parts: (string | undefined | null)[]
): string {
  return parts
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" · ");
}

function extractPromoOrCollectorNumber(text: string): string | undefined {
  const japaneseNo = text.match(/\bNo\.?\s*0*(\d{1,3})\b/i);
  if (japaneseNo) return `No.${japaneseNo[1]!.padStart(3, "0")}`;

  const fraction = text.match(/#?\s*(\d{1,3})\s*\/\s*(\d{1,3})\b/);
  if (fraction) return `${fraction[1]}/${fraction[2]}`;

  const hashNum = text.match(/#\s*([A-Z]{0,4}\d{1,4}[A-Z]?)\b/i);
  if (hashNum) return hashNum[1]!;

  const loneHash = text.match(/\b#\s*(\d{1,3})\b/);
  if (loneHash) return loneHash[1]!;

  const promo = text.match(PROMO_OR_SET_CODE);
  if (promo) {
    const prefix = promo[1]!.toUpperCase().replace(/\s/g, "");
    return `${prefix}${promo[2]}`;
  }

  const compact = text.match(/\b(SM|SWSH|SVP|TG|GG|OP|ST)\s*(\d{2,4})\b/i);
  if (compact) return `${compact[1]!.toUpperCase()}${compact[2]}`;

  return undefined;
}

function normalizePokemonSetName(fragment: string): string {
  const setName = fragment.trim().replace(/\s+/g, " ");
  const map: Array<[RegExp, string]> = [
    [/^BASE\s*(?:II|2)\b/i, "Base Set 2"],
    [/^BASE\s*SET\s*(?:II|2)\b/i, "Base Set 2"],
    [/^FOSSIL\b/i, "Fossil"],
    [/^JUNGLE\b/i, "Jungle"],
    [/^BASE\s*SET\b/i, "Base Set"],
    [/^BASE\b/i, "Base Set"],
    [/^BASIC\b/i, "Base Set"],
    [/^GYM\s*2\b/i, "Gym Challenge"],
    [/^GYM\s*CHALLENGE\b/i, "Gym Challenge"],
    [/^GYM\s*HEROES\b/i, "Gym Heroes"],
    [/^TEAM\s*ROCKET\b/i, "Team Rocket"],
    [/^SKYRIDGE\b/i, "Skyridge"],
    [/^AQUAPOLIS\b/i, "Aquapolis"],
    [/^THE\s*TOWN\s*ON\s*NO\s*MAP\b/i, "Aquapolis"],
    [/^EXPEDITION(?:\s*BASE\s*SET)?\b/i, "Expedition Base Set"],
    [/^NEO\s*REVELATION\b/i, "Neo Revelation"],
    [/^NEO\s*3\b/i, "Neo Revelation"],
    [/^NEO\s*GENESIS\b/i, "Neo Genesis"],
    [/^NEO\s*DISCOVERY\b/i, "Neo Discovery"],
    [/^NEO\s*DESTINY\b/i, "Neo Destiny"],
    [/^SOUTHERN\s*ISLANDS\b/i, "Southern Islands"],
    [/^(?:WIZARDS\s*)?(?:BLACK|BLK)\s*STAR\s*PROMO\b/i, "Wizards Black Star Promos"],
    [/^PROMO\b/i, "Wizards Black Star Promos"],
    [/^SUN\s*&?\s*MOON\b/i, "Sun & Moon"],
    [/^SWORD\s*&?\s*SHIELD\b/i, "Sword & Shield"],
    [/^SCARLET\s*&?\s*VIOLET\b/i, "Scarlet & Violet"],
    [/^GAME\b/i, "Base Set"],
  ];
  for (const [re, name] of map) {
    if (re.test(setName)) return name;
  }
  return setName;
}

type PsaPokemonLabelIdentity = {
  set?: string;
  name?: string;
  language?: string;
  printStamps?: string;
  details?: string;
};

function appendDetail(existing: string | undefined, extra: string): string {
  if (!existing?.trim()) return extra;
  if (existing.toLowerCase().includes(extra.toLowerCase())) return existing;
  return `${existing.trim()} · ${extra}`;
}

const PSA_SET_PATTERNS: Array<{ pattern: RegExp; set: string; printStamp?: string; language?: string; nonTcg?: boolean }> = [
  { pattern: /\bBASE\s*(?:II|2)\b/i, set: "Base Set 2" },
  { pattern: /\bBASE\s*SET\s*(?:II|2)\b/i, set: "Base Set 2" },
  { pattern: /\bBASIC\b/i, set: "Base Set", language: "Japanese" },
  { pattern: /\bJAPANESE\s+BASE\b/i, set: "Base Set", language: "Japanese" },
  { pattern: /\bGYM\s*2\b/i, set: "Gym Challenge", language: "Japanese" },
  { pattern: /\bGYM\s*CHALLENGE\b/i, set: "Gym Challenge" },
  { pattern: /\bGYM\s*HEROES\b/i, set: "Gym Heroes" },
  { pattern: /\bTEAM\s*ROCKET\b/i, set: "Team Rocket" },
  { pattern: /\bFOSSIL\b/i, set: "Fossil" },
  { pattern: /\bJUNGLE\b/i, set: "Jungle" },
  { pattern: /\bSKYRIDGE\b/i, set: "Skyridge" },
  { pattern: /\bTHE\s*TOWN\s*ON\s*NO\s*MAP\b/i, set: "Aquapolis", language: "Japanese" },
  { pattern: /\bAQUAPOLIS\b/i, set: "Aquapolis" },
  { pattern: /\bEXPEDITION(?:\s*-\s*1ST\s*EDITION|\s*1ST\s*EDITION)?\b/i, set: "Expedition Base Set" },
  { pattern: /\bNEO\s*3\b/i, set: "Neo Revelation", language: "Japanese" },
  { pattern: /\bNEO\s*REVELATION\b/i, set: "Neo Revelation" },
  { pattern: /\bNEO\s*GENESIS\b/i, set: "Neo Genesis" },
  { pattern: /\bNEO\s*DISCOVERY\b/i, set: "Neo Discovery" },
  { pattern: /\bNEO\s*DESTINY\b/i, set: "Neo Destiny" },
  { pattern: /\b(?:BLK|BLACK)\s*STAR\s*PROMO\b|\bWIZ(?:ARDS)?\.?\s*GOLD\s*STAMP\b/i, set: "Wizards Black Star Promos" },
  { pattern: /\bTOPPS\b|\bSEALDASS\b|\bCARDDASS\b|\bMEIJI\b|\bMOVIE\s*EDITION\b/i, set: "Pokemon non-TCG collectible", nonTcg: true },
];

function cleanPsaPokemonName(value: string): string | undefined {
  const cleaned = value
    .replace(/\b(?:19\d{2}|20\d{2})\b/g, " ")
    .replace(/\b(?:POKEMON|POKÉMON|P\.?\s*M\.?|JAPANESE|GAME|PROMO|E-CARD|POCKET\s*MONSTERS)\b/gi, " ")
    .replace(/\b(?:HOLO|HOLOFOIL|REVERSE|NM[-/]?MT\+?|NM|MINT|EX|GEM\s*MT|GEM\s*MINT)\b/gi, " ")
    .replace(/\b(?:BASE|BASIC|II|GYM|HEROES|CHALLENGE|FOSSIL|JUNGLE|SKYRIDGE|AQUAPOLIS|EXPEDITION|NEO|REVELATION|GENESIS|DISCOVERY|DESTINY)\b/gi, " ")
    .replace(/\b(?:1ST|FIRST)\s*EDITION\b/gi, " ")
    .replace(/#\s*[A-Z]{0,4}\d+[A-Z]?/gi, " ")
    .replace(/\bNo\.?\s*\d{1,3}\b/gi, " ")
    .replace(/\b\d{1,2}(?:\.\d)?\b/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2) return undefined;
  return cleaned
    .split(/\s+/)
    .map((part) =>
      /^[A-Z0-9'.]+$/.test(part)
        ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        : part,
    )
    .join(" ")
    .replace(/\bS\b/g, "'s")
    .replace(/\bPorygon2\b/i, "Porygon2");
}

function parsePsaPokemonLabelIdentity(raw: string): PsaPokemonLabelIdentity {
  const text = raw.replace(/\s+/g, " ").trim();
  const identity: PsaPokemonLabelIdentity = {};
  if (/\bJAPANESE\b|\bP\.?\s*M\.?\b|\bPOCKET\s*MONSTERS\b/i.test(text)) {
    identity.language = "Japanese";
  }
  if (/\b1ST\s*EDITION\b|\bFIRST\s*EDITION\b/i.test(text)) {
    identity.printStamps = "1st Edition";
  }

  let matchInfo: (typeof PSA_SET_PATTERNS)[number] | undefined;
  let match: RegExpExecArray | null = null;
  for (const row of PSA_SET_PATTERNS) {
    match = row.pattern.exec(text);
    if (match) {
      matchInfo = row;
      break;
    }
  }

  if (matchInfo) {
    identity.set = matchInfo.set;
    if (matchInfo.language) identity.language = matchInfo.language;
    if (matchInfo.printStamp) identity.printStamps = matchInfo.printStamp;
    if (matchInfo.nonTcg) {
      identity.details = "Pokemon non-TCG collectible";
    }
  } else if (/\bPOKEMON\s+GAME\b/i.test(text)) {
    identity.set = "Base Set";
  }

  const numberIndex = text.search(/\bNo\.?\s*\d{1,3}\b|#\s*[A-Z]{0,4}\d+[A-Z]?|\b\d{1,3}\s*\/\s*\d{1,3}\b/i);
  const beforeNumber = numberIndex >= 0 ? text.slice(0, numberIndex) : text;

  let nameSegment = "";
  if (match && match.index != null) {
    const setStart = match.index;
    const setEnd = setStart + match[0].length;
    const beforeSet = beforeNumber.slice(0, setStart);
    const afterSet = beforeNumber.slice(setEnd);
    const cleanedBefore = cleanPsaPokemonName(beforeSet);
    const cleanedAfter = cleanPsaPokemonName(afterSet);
    nameSegment = cleanedBefore ?? cleanedAfter ?? "";
  } else {
    nameSegment = cleanPsaPokemonName(beforeNumber) ?? "";
  }

  if (nameSegment) identity.name = nameSegment;
  return identity;
}

function nonEnglishBareSlabNumberIsLocalId(
  number: string | undefined,
  language: string | undefined,
): boolean {
  if (!number?.trim()) return false;
  if (!language?.trim() || /^english?$/i.test(language)) return false;
  const n = number.trim();
  if (/\d+\s*\/\s*\d+/.test(n)) return false;
  if (/^[A-Z]{1,5}\d+[A-Z]?$/i.test(n)) return false;
  return /^#?\d{1,4}$/.test(n);
}

function extractSetFromLabel(text: string, year?: string): string | undefined {
  const setPatterns = [
    /\bPOKEMON\s+([A-Z0-9][A-Z0-9\s.'&-]+?)(?:\s+-\s+|\s+1ST|\s+UNLIMITED|\s+#|\s+\d{1,3}\s*\/|\s+[A-Z]{2,4}\d{2,}|\s*$)/i,
    /\bP\.?\s*M\.?\s+([A-Z][A-Z0-9\s.'&-]+?)(?:\s+-\s+|\s+#|\s+\d{1,3}\s*\/|\s+[A-Z]{2,4}\d{2,}|\s*$)/i,
    /\bONE\s*PIECE\s+([A-Z0-9][A-Z0-9\s.'-]+?)(?:\s+#|\s+[A-Z]{2,}\d+|\s*$)/i,
  ];
  for (const pattern of setPatterns) {
    const m = text.match(pattern);
    if (m?.[1]?.trim()) {
      return normalizePokemonSetName(m[1]);
    }
  }

  if (year) {
    const afterYear = text.match(
      new RegExp(
        `\\b${year}\\b\\s+([A-Z][A-Z0-9\\s.'&/-]{3,60}?)(?=\\s+#|\\s+\\d{1,3}\\s*/|\\s+[A-Z]{2,4}\\d{2,}|\\s+[A-Z][a-z]{2,})`,
        "i",
      ),
    );
    if (afterYear?.[1]?.trim() && !/^(PSA|CGC|BGS|SGC)\b/i.test(afterYear[1])) {
      const frag = afterYear[1].trim();
      if (!/^\d+$/.test(frag) && frag.length >= 3) {
        return normalizePokemonSetName(frag);
      }
    }
  }

  const sportsBrand = text.match(
    /\b(TOPPS|PANINI|UPPER\s*DECK|DONRUSS|BOWMAN|SELECT|PRIZM|OPTIC|MOSAIC)\s+([A-Z0-9\s.'-]{2,40})/i,
  );
  if (sportsBrand) {
    return `${sportsBrand[1]!.trim()} ${sportsBrand[2]!.trim()}`.replace(/\s+/g, " ");
  }

  return undefined;
}

function extractNameFromLabel(text: string, number?: string): string | undefined {
  const nameFromEnd = text.match(
    /(?:#\s*\d{1,3}(?:\s*\/\s*\d{1,3})?|\d{1,3}\s*\/\s*\d{1,3}|[A-Z]{2,4}\d{2,4})\s+([A-Za-z][A-Za-z0-9\s.'-]{2,48})$/i,
  );
  if (nameFromEnd?.[1]) return nameFromEnd[1].trim();

  const afterNumber = number
    ? text.match(
        new RegExp(
          `(?:${number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|#\\s*\\d+)\\s+([A-Za-z][A-Za-z0-9\\s.'-]{2,48})`,
          "i",
        ),
      )
    : null;
  if (afterNumber?.[1]) return afterNumber[1].trim();

  const dashName = text.match(/\s+-\s+([A-Za-z][A-Za-z0-9\s.'-]{2,48})$/);
  if (dashName?.[1]) return dashName[1].trim();

  return undefined;
}

/** BGS/BVG sub-grade lines → details fragment. */
export function extractSlabSubgrades(text: string): string | undefined {
  const parts: string[] = [];
  const keys = ["centering", "corners", "edges", "surface"] as const;
  for (const key of keys) {
    const m = text.match(new RegExp(`\\b${key}\\s*[:.]?\\s*([\\d.]+)`, "i"));
    if (m?.[1]) {
      parts.push(`${key[0]!.toUpperCase()}${key.slice(1)} ${m[1]}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Qualifiers that belong in grade/details, not numeric grade alone. */
export function extractSlabGradeQualifiers(text: string): string[] {
  const qualifiers: string[] = [];
  if (/gem\s*mint/i.test(text)) qualifiers.push("GEM MT");
  if (/black\s*label/i.test(text)) qualifiers.push("Black Label");
  if (/pristine/i.test(text)) qualifiers.push("Pristine");
  if (/qualifier/i.test(text)) qualifiers.push("Qualifier");
  if (/authentic\s*only/i.test(text)) qualifiers.push("Authentic");
  return qualifiers;
}

/**
 * Parse year · set · collector # · name · grader · grade from PSA/CGC/BGS front label text.
 */
export function parseStructuredSlabLabel(
  labelTitle: string | undefined | null,
  extraText?: string | undefined | null,
): Partial<Pick<ExtractedCard, "year" | "set" | "number" | "name" | "grader" | "grade" | "language" | "printStamps" | "details">> {
  const combined = combineSlabLabelSources(labelTitle, extraText);
  if (!combined || combined.length < 4) return {};

  const lines = splitSlabLabelLines(combined);
  const raw = lines.length > 1 ? lines.join(" · ") : combined;

  const out: Partial<
    Pick<ExtractedCard, "year" | "set" | "number" | "name" | "grader" | "grade" | "language" | "printStamps" | "details">
  > = {};

  const yearMatch = raw.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) out.year = yearMatch[1];

  const psaPokemon = parsePsaPokemonLabelIdentity(raw);

  const graderMatch = raw.match(GRADER_PATTERN);
  if (graderMatch) out.grader = graderMatch[1]!.toUpperCase();

  const gradeMatch = raw.match(
    /\b(?:PSA|CGC|BGS|BVG|SGC|ACE|TAG|HGA|GMA)\s+(\d{1,2}(?:\.\d)?|GEM\s*MINT|NM[-/]?MT|PRISTINE|BLACK\s*LABEL)\b/i,
  );
  if (gradeMatch) {
    const g = gradeMatch[1]!.toUpperCase();
    out.grade = /GEM\s*MINT/i.test(g)
      ? "10"
      : /NM[-/]?MT/i.test(g)
        ? "8"
        : /BLACK\s*LABEL/i.test(g)
          ? "10"
          : /PRISTINE/i.test(g)
            ? "10"
            : gradeMatch[1]!;
  } else {
    const loneGrade = raw.match(
      /\b(?:^|\s)(10|9\.5|9|8\.5|8|7\.5|7)(?:\s|$|GEM|MINT)/i,
    );
    if (loneGrade && graderMatch) out.grade = loneGrade[1];
  }

  out.number = extractPromoOrCollectorNumber(raw);
  let suppressLocalSlabNumber = false;

  if (psaPokemon.language) out.language = psaPokemon.language;
  if (psaPokemon.printStamps) out.printStamps = psaPokemon.printStamps;
  if (psaPokemon.details) out.details = psaPokemon.details;
  if (
    nonEnglishBareSlabNumberIsLocalId(out.number, out.language) &&
    psaPokemon.set !== "Pokemon non-TCG collectible"
  ) {
    suppressLocalSlabNumber = true;
    out.details = appendDetail(
      out.details,
      `Slab local number retained from label: #${out.number?.replace(/^#/, "")}`,
    );
    out.number = undefined;
  }

  out.set = psaPokemon.set ?? extractSetFromLabel(raw, out.year);
  if (/1ST\s*EDITION/i.test(raw) && out.set && !/1st\s*edition/i.test(out.set)) {
    out.printStamps = "1st Edition";
  }

  out.name = psaPokemon.name ?? extractNameFromLabel(raw, out.number);

  for (const line of lines) {
    if (!out.grader) {
      const g = line.match(GRADER_PATTERN);
      if (g) out.grader = g[1]!.toUpperCase();
    }
    if (!out.number && !suppressLocalSlabNumber) out.number = extractPromoOrCollectorNumber(line);
    if (!out.set && TCG_SET_KEYWORDS.test(line)) {
      out.set = extractSetFromLabel(line, out.year);
    }
    if (!out.name && line.length > 3 && /[a-z]/i.test(line) && !GRADER_PATTERN.test(line)) {
      const candidate = extractNameFromLabel(line, out.number);
      if (candidate && candidate.length > (out.name?.length ?? 0)) {
        out.name = candidate;
      }
    }
  }

  return out;
}

/** Best-effort full label line for display when vision omits labelTitle. */
export function synthesizeSlabLabelTitle(
  card: Pick<ExtractedCard, "year" | "set" | "number" | "name" | "grader" | "grade" | "printStamps">,
): string | null {
  const identity = [card.year, card.set, card.number, card.name].filter(Boolean);
  const grade = [card.grader, card.grade].filter(Boolean).join(" ");
  const parts = [...identity, card.printStamps?.trim(), grade].filter(Boolean);
  return parts.length >= 2 ? parts.join(" · ") : null;
}
