import { registerRuntimeCacheClear } from "@/lib/server/runtime-caches";
import type { ExtractedCard } from "@/lib/scan/schemas";

const BASE = "https://api.tcgdex.net/v2";
const DEFAULT_TIMEOUT_MS = 6_000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

const LANGUAGE_TO_TCGDEX = new Map<string, string>([
  ["en", "en"],
  ["eng", "en"],
  ["english", "en"],
  ["fr", "fr"],
  ["fra", "fr"],
  ["fre", "fr"],
  ["french", "fr"],
  ["francais", "fr"],
  ["de", "de"],
  ["deu", "de"],
  ["ger", "de"],
  ["german", "de"],
  ["deutsch", "de"],
  ["es", "es"],
  ["spa", "es"],
  ["spanish", "es"],
  ["espanol", "es"],
  ["it", "it"],
  ["ita", "it"],
  ["italian", "it"],
  ["italiano", "it"],
  ["pt", "pt-br"],
  ["pt-br", "pt-br"],
  ["br", "pt-br"],
  ["portuguese", "pt-br"],
  ["brazilian portuguese", "pt-br"],
  ["portugues", "pt-br"],
  ["ja", "ja"],
  ["jp", "ja"],
  ["jpn", "ja"],
  ["japanese", "ja"],
  ["zh", "zh-tw"],
  ["zh-tw", "zh-tw"],
  ["traditional chinese", "zh-tw"],
  ["chinese traditional", "zh-tw"],
  ["id", "id"],
  ["indonesian", "id"],
  ["thai", "th"],
  ["th", "th"],
]);

export type TcgDexAlias = {
  source: "tcgdex";
  language: string;
  printedName: string;
  tcgdexId: string;
  localId: string | null;
  englishName: string;
  englishSetName: string | null;
  englishNumber: string | null;
  printedSetName: string | null;
  imageUrl: string | null;
};

export type TcgDexLocalizedCard = {
  id: string;
  name: string | null;
  imageUrl: string | null;
  setName: string | null;
};

type TcgDexBrief = {
  id?: string;
  localId?: string;
  name?: string;
  image?: string;
};

type TcgDexCard = TcgDexBrief & {
  set?: {
    id?: string;
    name?: string;
    cardCount?: { official?: number; total?: number };
  };
};

const cache = new Map<string, { storedAt: number; value: TcgDexAlias[] }>();

const setNameMaps = new Map<string, { storedAt: number; value: Map<string, string> }>();
const localizedCardCache = new Map<
  string,
  { storedAt: number; value: TcgDexLocalizedCard | null }
>();

function enabled(): boolean {
  return process.env.TCGDEX_MULTILINGUAL_RESOLVER !== "0";
}

function ttlMs(): number {
  const raw = process.env.TCGDEX_CACHE_TTL_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

function maxEntries(): number {
  const raw = process.env.TCGDEX_CACHE_MAX?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_ENTRIES;
}

function timeoutMs(): number {
  const raw = process.env.TCGDEX_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20_000) : DEFAULT_TIMEOUT_MS;
}

function normalizeText(value: string | undefined | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function tcgDexLanguageCode(
  language: string | undefined | null,
): string | null {
  const key = normalizeText(language);
  if (!key) return null;
  return LANGUAGE_TO_TCGDEX.get(key) ?? null;
}

function candidatePrintedName(card: ExtractedCard): string | null {
  const printed = card.printedName?.trim();
  if (printed) return printed;
  const language = tcgDexLanguageCode(card.language);
  if (language && language !== "en" && card.name?.trim())
    return card.name.trim();
  return null;
}

function cacheKey(card: ExtractedCard): string | null {
  const language = tcgDexLanguageCode(card.language);
  const printedName = candidatePrintedName(card);
  if (!language || language === "en" || !printedName) return null;
  return JSON.stringify({
    language,
    printedName: normalizeText(printedName),
    number: card.number?.trim().toLowerCase() ?? "",
    set: card.set?.trim().toLowerCase() ?? "",
  });
}

async function fetchTcgdexJson<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T | null> {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs()),
      next: { revalidate: 24 * 60 * 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchCard(
  language: string,
  id: string,
): Promise<TcgDexCard | null> {
  return fetchTcgdexJson<TcgDexCard>(
    `/${encodeURIComponent(language)}/cards/${encodeURIComponent(id)}`,
  );
}

async function searchCards(
  language: string,
  name: string,
): Promise<TcgDexBrief[]> {
  const rows = await fetchTcgdexJson<TcgDexBrief[]>(
    `/${encodeURIComponent(language)}/cards`,
    {
      name,
      "pagination:itemsPerPage": "16",
    },
  );
  return Array.isArray(rows) ? rows : [];
}

function localIdHead(value: string | undefined | null): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const head = raw.split("/")[0]?.trim();
  return head ? head.replace(/^0+(?=\d)/, "").toLowerCase() : null;
}

function briefMatchesNumber(card: ExtractedCard, brief: TcgDexBrief): boolean {
  const number = localIdHead(card.number);
  if (!number) return true;
  const local = localIdHead(brief.localId);
  if (!local) return true;
  return number === local;
}

function aliasFromCards(args: {
  language: string;
  printedName: string;
  localized: TcgDexCard;
  english: TcgDexCard;
}): TcgDexAlias | null {
  if (!args.localized.id || !args.english.name) return null;
  return {
    source: "tcgdex",
    language: args.language,
    printedName: args.localized.name?.trim() || args.printedName,
    tcgdexId: args.localized.id,
    localId: args.localized.localId ?? args.english.localId ?? null,
    englishName: args.english.name,
    englishSetName: args.english.set?.name ?? null,
    englishNumber: args.english.localId ?? null,
    printedSetName: args.localized.set?.name ?? null,
    imageUrl: args.localized.image ?? args.english.image ?? null,
  };
}

export async function resolveTcgDexAliases(
  card: ExtractedCard,
): Promise<TcgDexAlias[]> {
  if (!enabled()) return [];
  const key = cacheKey(card);
  if (!key) return [];
  const cached = cache.get(key);
  if (cached && Date.now() - cached.storedAt <= ttlMs()) return cached.value;

  const language = tcgDexLanguageCode(card.language);
  const printedName = candidatePrintedName(card);
  if (!language || !printedName) return [];

  const briefs = (await searchCards(language, printedName))
    .filter((brief) => brief.id && briefMatchesNumber(card, brief))
    .slice(0, 8);

  const aliases: TcgDexAlias[] = [];
  for (const brief of briefs) {
    const id = brief.id;
    if (!id) continue;
    const [localized, english] = await Promise.all([
      fetchCard(language, id),
      fetchCard("en", id),
    ]);
    if (!localized || !english) continue;
    const alias = aliasFromCards({ language, printedName, localized, english });
    if (alias) aliases.push(alias);
  }

  while (cache.size >= maxEntries()) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
    else break;
  }
  cache.set(key, { storedAt: Date.now(), value: aliases });
  return aliases;
}

async function fetchTcgDexSetNameMap(language: string): Promise<Map<string, string> | null> {
  const lang = tcgDexLanguageCode(language) ?? null;
  if (!lang) return null;

  const cacheKey = lang;
  const cached = setNameMaps.get(cacheKey);
  if (cached && Date.now() - cached.storedAt <= ttlMs()) return cached.value;

  let page = 1;
  const itemsPerPage = 100;
  const out = new Map<string, string>();

  for (;;) {
    const rows = await fetchTcgdexJson<Array<{ id?: string; name?: string }>>(
      `/${encodeURIComponent(lang)}/sets`,
      {
        "pagination:page": String(page),
        "pagination:itemsPerPage": String(itemsPerPage),
      },
    );
    if (!rows || rows.length === 0) break;
    for (const row of rows) {
      const id = row.id?.trim();
      const name = row.name?.trim();
      if (id && name) out.set(id, name);
    }
    page += 1;
    // Safety stop.
    if (page > 50) break;
  }

  setNameMaps.set(cacheKey, { storedAt: Date.now(), value: out });
  return out;
}

export async function getTcgDexSetNameMapForLanguage(
  language: string,
): Promise<Map<string, string> | null> {
  return fetchTcgDexSetNameMap(language);
}

/** Candidate TCGdex ids for a pokemontcg.io card id (e.g. sv1-1 → sv01-001). */
export function tcgDexCandidateCardIds(pokemonCardId: string): string[] {
  const id = pokemonCardId.trim();
  const dash = id.lastIndexOf("-");
  if (dash <= 0) return [id];

  const setPart = id.slice(0, dash);
  const numRaw = id.slice(dash + 1);
  const numStripped = numRaw.replace(/^0+/, "") || numRaw;
  const num3 = numStripped.padStart(3, "0");

  const out = new Set<string>([id, `${setPart}-${num3}`]);

  const sv = setPart.match(/^sv(\d+(?:\.\d+[a-z])?)$/i);
  if (sv) {
    const n = sv[1]!;
    const setDex = /^\d$/.test(n) ? `sv0${n}` : `sv${n}`;
    out.add(`${setDex}-${num3}`);
  }

  return [...out];
}

export function tcgDexImageUrls(imageBase: string): { small: string; large: string } {
  const base = imageBase.trim().replace(/\/$/, "");
  return { small: `${base}/low.webp`, large: `${base}/high.webp` };
}

async function fetchTcgDexCardByCandidates(
  language: string,
  candidates: string[],
): Promise<TcgDexCard | null> {
  for (const candidate of candidates) {
    const row = await fetchCard(language, candidate);
    if (row?.image?.trim()) return row;
  }
  return null;
}

export async function fetchTcgDexCardImageByPokemonId(
  language: string,
  pokemonCardId: string,
): Promise<{ small: string; large: string } | null> {
  const lang = tcgDexLanguageCode(language) ?? "en";
  const row = await fetchTcgDexCardByCandidates(lang, tcgDexCandidateCardIds(pokemonCardId));
  if (!row?.image?.trim()) return null;
  return tcgDexImageUrls(row.image);
}

export async function enrichCardSummariesWithTcgDexImages<
  T extends { id: string; images?: { small?: string; large?: string } },
>(cards: T[], language = "en"): Promise<T[]> {
  if (cards.length === 0) return cards;
  const out = [...cards];
  let idx = 0;
  const workers = Math.min(10, cards.length);

  async function worker() {
    for (;;) {
      const i = idx;
      idx += 1;
      if (i >= cards.length) break;
      const card = cards[i]!;
      if (card.images?.small || card.images?.large) {
        out[i] = card;
        continue;
      }
      const urls = await fetchTcgDexCardImageByPokemonId(language, card.id);
      out[i] = urls ? { ...card, images: urls } : card;
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return out;
}

export async function fetchTcgDexCardLocalizedById(
  language: string,
  id: string,
): Promise<TcgDexLocalizedCard | null> {
  const lang = tcgDexLanguageCode(language) ?? null;
  const cardId = id.trim();
  if (!lang || !cardId) return null;

  const key = `${lang}|${cardId}`.toLowerCase();
  const cached = localizedCardCache.get(key);
  if (cached && Date.now() - cached.storedAt <= ttlMs()) return cached.value;

  const row = await fetchTcgDexCardByCandidates(lang, tcgDexCandidateCardIds(cardId));
  const imageBase = row?.image?.trim();
  const out: TcgDexLocalizedCard | null = row
    ? {
        id: row.id ?? cardId,
        name: row.name?.trim() ?? null,
        imageUrl: imageBase ? tcgDexImageUrls(imageBase).large : null,
        setName: row.set?.name?.trim() ?? null,
      }
    : null;

  while (localizedCardCache.size >= maxEntries()) {
    const first = localizedCardCache.keys().next().value;
    if (first) localizedCardCache.delete(first);
    else break;
  }
  localizedCardCache.set(key, { storedAt: Date.now(), value: out });
  return out;
}

export async function getTcgDexSetNameForLanguage(
  language: string,
  setId: string,
): Promise<string | null> {
  const lang = tcgDexLanguageCode(language) ?? null;
  const sid = setId.trim();
  if (!lang || !sid) return null;

  const map = await fetchTcgDexSetNameMap(lang);
  if (!map) return null;
  return map.get(sid) ?? null;
}

export function clearTcgDexCache(): void {
  cache.clear();
  setNameMaps.clear();
  localizedCardCache.clear();
}

registerRuntimeCacheClear(clearTcgDexCache);
