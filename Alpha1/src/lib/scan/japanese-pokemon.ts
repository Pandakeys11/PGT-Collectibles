import type { ExtractedCard } from "@/lib/scan/schemas";

export type JapanesePokemonMatchMethod =
  | "exact_japanese_name_number"
  | "set_number_match"
  | "artwork_similarity"
  | "known_counterpart_mapping"
  | "translation_fallback"
  | "low_confidence_manual_review";

type NameRow = {
  japanese: string;
  english: string;
  no?: string;
  baseSetNumber?: string;
};

type SetRow = {
  japaneseSet: string;
  englishSet: string;
  year?: string;
  patterns: RegExp[];
};

const JAPANESE_CHAR_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;

const NAME_ROWS: NameRow[] = [
  { japanese: "リザードン", english: "Charizard", no: "006", baseSetNumber: "4/102" },
  { japanese: "カリザード", english: "Charizard", no: "006" },
  { japanese: "カメックス", english: "Blastoise", no: "009", baseSetNumber: "2/102" },
  { japanese: "フシギバナ", english: "Venusaur", no: "003", baseSetNumber: "15/102" },
  { japanese: "ミュウツー", english: "Mewtwo", no: "150", baseSetNumber: "10/102" },
  { japanese: "ライチュウ", english: "Raichu", no: "026", baseSetNumber: "14/102" },
  { japanese: "ギャラドス", english: "Gyarados", no: "130", baseSetNumber: "6/102" },
  { japanese: "キュウコン", english: "Ninetales", no: "038", baseSetNumber: "12/102" },
  { japanese: "ピッピ", english: "Clefairy", no: "035", baseSetNumber: "5/102" },
  { japanese: "ラッキー", english: "Chansey", no: "113", baseSetNumber: "3/102" },
  { japanese: "フーディン", english: "Alakazam", no: "065", baseSetNumber: "1/102" },
  { japanese: "カイリキー", english: "Machamp", no: "068", baseSetNumber: "8/102" },
  { japanese: "エビワラー", english: "Hitmonchan", no: "107", baseSetNumber: "7/102" },
  { japanese: "レアコイル", english: "Magneton", no: "082", baseSetNumber: "9/102" },
  { japanese: "ニドキング", english: "Nidoking", no: "034", baseSetNumber: "11/102" },
  { japanese: "ニョロボン", english: "Poliwrath", no: "062", baseSetNumber: "13/102" },
  { japanese: "サンダー", english: "Zapdos", no: "145", baseSetNumber: "16/102" },
  { japanese: "ピカチュウ", english: "Pikachu", no: "025" },
  { japanese: "ルギア", english: "Lugia", no: "249" },
  { japanese: "ホウオウ", english: "Ho-Oh", no: "250" },
  { japanese: "トゲチック", english: "Togetic", no: "176" },
  { japanese: "ポリゴン2", english: "Porygon2", no: "233" },
  { japanese: "メガニウム", english: "Meganium", no: "154" },
  { japanese: "リザードンex", english: "Charizard ex", no: "006" },
  { japanese: "リザードンV", english: "Charizard V", no: "006" },
  { japanese: "リザードンVMAX", english: "Charizard VMAX", no: "006" },
];

const SET_ROWS: SetRow[] = [
  {
    japaneseSet: "Japanese Base Set",
    englishSet: "Base Set",
    year: "1996",
    patterns: [
      /\bPMCG\s*1\b/i,
      /\bBASIC\b/i,
      /\bJAPANESE\s+BASE\b/i,
      /\bBASE\s+SET\b/i,
      /拡張パック/,
      /第\s*1\s*弾/,
    ],
  },
  {
    japaneseSet: "Japanese Jungle",
    englishSet: "Jungle",
    year: "1997",
    patterns: [/\bPMCG\s*2\b/i, /\bJAPANESE\s+JUNGLE\b/i, /ポケモンジャングル/],
  },
  {
    japaneseSet: "Japanese Fossil",
    englishSet: "Fossil",
    year: "1997",
    patterns: [/\bPMCG\s*3\b/i, /\bJAPANESE\s+FOSSIL\b/i, /化石の秘密/],
  },
  {
    japaneseSet: "Japanese Team Rocket",
    englishSet: "Team Rocket",
    year: "1997",
    patterns: [/\bPMCG\s*4\b/i, /\bJAPANESE\s+ROCKET\b/i, /ロケット団/],
  },
  {
    japaneseSet: "Japanese Gym Heroes",
    englishSet: "Gym Heroes",
    year: "1998",
    patterns: [/\bPMCG\s*5\b/i, /\bGYM\s*1\b/i, /リーダーズスタジアム/],
  },
  {
    japaneseSet: "Japanese Gym Challenge",
    englishSet: "Gym Challenge",
    year: "1998",
    patterns: [/\bPMCG\s*6\b/i, /\bGYM\s*2\b/i, /闇からの挑戦/],
  },
  {
    japaneseSet: "Japanese Neo Revelation",
    englishSet: "Neo Revelation",
    year: "2000",
    patterns: [/\bNEO\s*3\b/i, /めざめる伝説/],
  },
  {
    japaneseSet: "Japanese Aquapolis",
    englishSet: "Aquapolis",
    year: "2002",
    patterns: [/\bTHE\s+TOWN\s+ON\s+NO\s+MAP\b/i, /地図にない町/],
  },
];

function compact(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNo(value: string | undefined | null): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const match =
    raw.match(/\bNo\.?\s*0*(\d{1,3})\b/i) ??
    raw.match(/\bNO\s*0*(\d{1,3})\b/i) ??
    raw.match(/(?:^|\s)#?\s*0*(\d{3})(?:\s|$)/);
  return match?.[1]?.padStart(3, "0") ?? null;
}

function displayNo(no: string | null): string | undefined {
  return no ? `No.${no.padStart(3, "0")}` : undefined;
}

export function hasJapaneseText(value: string | undefined | null): boolean {
  return JAPANESE_CHAR_PATTERN.test(value ?? "");
}

export function isJapanesePokemonCard(card: Pick<ExtractedCard, "language" | "printedName" | "name" | "set" | "details" | "labelTitle">): boolean {
  const language = (card.language ?? "").trim();
  if (/^(ja|jp|jpn|japanese)$/i.test(language)) return true;
  return hasJapaneseText(compact([card.printedName, card.name, card.set, card.details, card.labelTitle]));
}

function findJapaneseName(text: string): NameRow | null {
  const sorted = [...NAME_ROWS].sort((a, b) => b.japanese.length - a.japanese.length);
  return sorted.find((row) => text.includes(row.japanese)) ?? null;
}

function findNameByEnglish(value: string | undefined | null): NameRow | null {
  const name = (value ?? "").trim().toLowerCase();
  if (!name) return null;
  return NAME_ROWS.find((row) => row.english.toLowerCase() === name) ?? null;
}

function findSet(text: string): SetRow | null {
  return SET_ROWS.find((row) => row.patterns.some((pattern) => pattern.test(text))) ?? null;
}

/** Release year for vintage→modern ordering (overlay set names, English counterpart, or ISO date). */
export function resolveJapaneseSetReleaseYear(input: {
  localizedSetName?: string | null;
  englishSetName?: string | null;
  releaseDate?: string | null;
}): string | null {
  const iso = input.releaseDate?.trim().slice(0, 4);
  if (iso && /^\d{4}$/.test(iso)) return iso;
  const text = compact([input.localizedSetName, input.englishSetName]);
  if (!text) return null;
  return findSet(text)?.year ?? null;
}

function statusForConfidence(confidence: number): "confirmed" | "needs_soft_review" | "needs_manual_review" {
  if (confidence >= 0.9) return "confirmed";
  if (confidence >= 0.7) return "needs_soft_review";
  return "needs_manual_review";
}

export function normalizeJapanesePokemonIdentity(card: ExtractedCard): ExtractedCard {
  const rawText = compact([
    card.rawDetectedText,
    card.labelTitle,
    card.printedName,
    card.name,
    card.set,
    card.number,
    card.details,
    card.printStamps,
  ]);
  const japanese = isJapanesePokemonCard(card) || /\bP\.?\s*M\.?\s+JAPANESE\b/i.test(rawText);
  if (!japanese) return card;

  const nameRow = findJapaneseName(rawText) ?? findNameByEnglish(card.name);
  const setRow = findSet(rawText);
  const no = normalizeNo(card.number) ?? normalizeNo(rawText) ?? nameRow?.no ?? null;
  const exactJapaneseNameNumber = Boolean(nameRow?.japanese && no && (!nameRow.no || nameRow.no === no));
  const baseSetCounterpartNumber =
    setRow?.englishSet === "Base Set" && nameRow?.baseSetNumber ? nameRow.baseSetNumber : undefined;
  const confidence =
    exactJapaneseNameNumber && setRow
      ? 0.96
      : exactJapaneseNameNumber
        ? 0.9
        : nameRow && setRow
          ? 0.84
          : nameRow
            ? 0.74
            : 0.55;
  const matchMethod: JapanesePokemonMatchMethod =
    exactJapaneseNameNumber && setRow
      ? "exact_japanese_name_number"
      : setRow && no
        ? "set_number_match"
        : nameRow
          ? "known_counterpart_mapping"
          : "low_confidence_manual_review";
  const japaneseSet = setRow?.japaneseSet ?? (card.set?.trim() ? `Japanese ${card.set.trim().replace(/^Japanese\s+/i, "")}` : undefined);
  const englishSet = setRow?.englishSet ?? card.setNameEnglish ?? undefined;
  const japaneseName =
    card.japaneseName?.trim() ||
    (card.printedName && hasJapaneseText(card.printedName) ? card.printedName.trim() : undefined) ||
    nameRow?.japanese;
  const englishName =
    card.englishCounterpartName?.trim() ||
    nameRow?.english ||
    (hasJapaneseText(card.name) ? undefined : card.name?.trim());

  const details = [
    card.details,
    matchMethod === "low_confidence_manual_review"
      ? "Japanese identity needs manual review"
      : "Japanese counterpart matched",
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ...card,
    rawDetectedText: card.rawDetectedText ?? (rawText || undefined),
    detectedLanguage: "Japanese",
    language: "Japanese",
    japaneseName,
    englishCounterpartName: englishName,
    printedName: japaneseName ?? card.printedName,
    name: englishName ?? card.name,
    setNameJapanese: japaneseSet,
    setNameEnglish: englishSet,
    set: japaneseSet ?? card.set,
    number: displayNo(no) ?? card.number,
    englishCounterpartNumber: baseSetCounterpartNumber ?? card.englishCounterpartNumber,
    year: setRow?.year ?? card.year,
    matchConfidence: confidence,
    matchMethod,
    japaneseMatchStatus: statusForConfidence(confidence),
    marketLanguage: "Japanese",
    pricingConfidence: card.pricingConfidence ?? (confidence >= 0.9 ? 0.82 : 0.62),
    fallbackUsed: card.fallbackUsed ?? false,
    details: details || undefined,
  };
}

export function toCatalogCounterpartCard(card: ExtractedCard): ExtractedCard {
  if (!isJapanesePokemonCard(card)) return card;
  return {
    ...card,
    name: card.englishCounterpartName?.trim() || card.name,
    set: card.setNameEnglish?.trim() || card.set?.replace(/^Japanese\s+/i, ""),
    number: card.englishCounterpartNumber?.trim() || card.number,
  };
}

export function japaneseMarketIdentityParts(card: ExtractedCard): string[] {
  if (!isJapanesePokemonCard(card)) return [];
  const grade =
    card.grader && card.grade
      ? `${card.grader.toUpperCase()} ${card.grade}`.replace(/\s+/g, " ")
      : null;
  return [
    "Japanese",
    card.name,
    card.setNameJapanese ?? card.set,
    card.number,
    card.printedName,
    card.year,
    grade,
  ].filter((part): part is string => Boolean(part?.trim()));
}
