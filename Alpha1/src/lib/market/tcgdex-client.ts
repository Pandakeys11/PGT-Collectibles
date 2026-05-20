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

export function clearTcgDexCache(): void {
  cache.clear();
}

registerRuntimeCacheClear(clearTcgDexCache);
