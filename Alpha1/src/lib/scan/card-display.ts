import type { ExtractedCard } from "@/lib/scan/schemas";

/** Fields shared by scan cards and saved DB rows. */
export type CardIdentityLike = {
  name?: string | null;
  printedName?: string | null;
  printed_name?: string | null;
  language?: string | null;
};

function readPrintedName(card: CardIdentityLike): string {
  return (card.printedName ?? card.printed_name ?? "").trim();
}

function readName(card: CardIdentityLike): string {
  return (card.name ?? "").trim();
}

function readLanguage(card: CardIdentityLike): string {
  return (card.language ?? "").trim();
}

export function normalizeCardLanguage(language: string | undefined | null): string {
  return (language ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isNonEnglishLanguage(language: string | undefined | null): boolean {
  const lang = normalizeCardLanguage(language);
  if (!lang) return false;
  return lang !== "en" && lang !== "english" && lang !== "eng";
}

/** English catalog / FMV identity (kept in `name` after catalog merge). */
export function catalogEnglishName(card: CardIdentityLike): string {
  return readName(card);
}

/** On-card visible title when present. */
export function localizedPrintedName(card: CardIdentityLike): string | null {
  const printed = readPrintedName(card);
  return printed || null;
}

function namesEquivalent(a: string, b: string): boolean {
  if (!a || !b) return false;
  return normalizeCardLanguage(a) === normalizeCardLanguage(b);
}

/**
 * Primary list title: show on-card name for non-English prints; otherwise catalog/vision name.
 */
export function getCardDisplayTitle(card: CardIdentityLike): string {
  const english = catalogEnglishName(card);
  const printed = localizedPrintedName(card);
  const lang = readLanguage(card);

  if (printed && isNonEnglishLanguage(lang)) {
    return printed;
  }
  if (printed && english && !namesEquivalent(printed, english)) {
    return printed;
  }
  return english || printed || "—";
}

/**
 * Secondary line under title: English catalog name + language when the title is localized.
 */
export function getCardDisplaySubtitle(card: CardIdentityLike): string | null {
  const title = getCardDisplayTitle(card);
  const english = catalogEnglishName(card);
  const lang = readLanguage(card);
  const parts: string[] = [];

  if (english && !namesEquivalent(title, english)) {
    parts.push(english);
  }
  if (lang && isNonEnglishLanguage(lang)) {
    parts.push(lang);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Name used for English catalog image lookup (queue thumb). */
export function catalogImageLookupName(card: ExtractedCard): string {
  return catalogEnglishName(card) || localizedPrintedName(card) || "—";
}

/** Minimum identity to run catalog / market enrich. */
export function hasCatalogIdentityFields(card: ExtractedCard): boolean {
  const english = catalogEnglishName(card);
  if (english.length >= 2) return true;
  const printed = localizedPrintedName(card);
  return Boolean(printed && printed.length >= 2 && isNonEnglishLanguage(card.language));
}

/** Prefer English `name`, else localized printed title for catalog API search. */
export function effectiveCatalogSearchName(card: ExtractedCard): string | null {
  const english = catalogEnglishName(card);
  if (english.length >= 2) return english;
  const printed = localizedPrintedName(card);
  if (printed && printed.length >= 2 && isNonEnglishLanguage(card.language)) return printed;
  return english || printed || null;
}

export function getCardImageAlt(card: CardIdentityLike): string {
  const title = getCardDisplayTitle(card);
  const sub = getCardDisplaySubtitle(card);
  return sub ? `${title} (${sub})` : title;
}
