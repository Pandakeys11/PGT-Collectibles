import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

export type CardNumberEvidenceLevel =
  | "exactFraction"
  | "numberWithSetTotal"
  | "prefixOnly"
  | "missing"
  | "conflict";

export type CardNumberEvidence = {
  level: CardNumberEvidenceLevel;
  matched: boolean;
  strong: boolean;
  reason: string;
};

const FOREIGN_LANGUAGE_TERMS = [
  "spanish",
  "dutch",
  "french",
  "german",
  "italian",
  "portuguese",
  "japanese",
  "korean",
  "chinese",
];

const DERIVATIVE_VARIANT_TERMS = [
  "celebrations",
  "classic collection",
  "evolutions",
  "topps",
  "sticker",
  "custom card",
  "metal card",
];

const STOP_WORDS = new Set([
  "pokemon",
  "card",
  "cards",
  "tcg",
  "graded",
  "grade",
  "holo",
  "holofoil",
  "reverse",
  "foil",
  "rare",
  "promo",
  "the",
  "and",
]);

export function normalizeLookupToken(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCardNumber(value: string | null | undefined): string {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[#.]/g, "");

  if (!raw) return "";
  if (raw.includes("/")) {
    const [left, right] = raw.split("/", 2);
    const normalizedLeft = /^\d+$/.test(left) ? String(Number(left)) : left;
    const normalizedRight = /^\d+$/.test(right) ? String(Number(right)) : right;
    return `${normalizedLeft}/${normalizedRight}`;
  }

  return /^\d+$/.test(raw) ? String(Number(raw)) : raw;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function boundaryPattern(value: string): RegExp {
  return new RegExp(`(^|[^A-Z0-9])${escapeRegex(value)}([^A-Z0-9]|$)`, "i");
}

function fractionPattern(value: string): RegExp {
  return new RegExp(`(^|[^A-Z0-9])${escapeRegex(value).replace(/\\\//g, "[/\\\\ ]?")}([^A-Z0-9]|$)`, "i");
}

function extractTitleNumberTokens(title: string): string[] {
  return Array.from(
    new Set(
      String(title ?? "")
        .toUpperCase()
        .match(/#?\b[A-Z]{0,4}\d+[A-Z]?(?:\s*\/\s*\d+)?\b/g)
        ?.map((token) => normalizeCardNumber(token.replace(/^#/, "")))
        .filter((token) => token.length > 0 && token.length <= 14) ?? [],
    ),
  );
}

export function getCardNumberEvidence(
  text: string | null | undefined,
  cardNumber: string | null | undefined,
): CardNumberEvidence {
  const normalized = normalizeCardNumber(cardNumber);
  if (!normalized) return { level: "missing", matched: false, strong: false, reason: "no-card-number" };

  const title = String(text ?? "").toUpperCase();
  if (!title) return { level: "missing", matched: false, strong: false, reason: "empty-title" };

  if (normalized.includes("/")) {
    const [prefix, total] = normalized.split("/", 2);
    if (fractionPattern(normalized).test(title)) {
      return { level: "exactFraction", matched: true, strong: true, reason: `matched ${normalized}` };
    }
    if (prefix && total && boundaryPattern(prefix).test(title) && boundaryPattern(total).test(title)) {
      return {
        level: "numberWithSetTotal",
        matched: true,
        strong: true,
        reason: `matched ${prefix} and set total ${total}`,
      };
    }
    const titleFractions = extractTitleNumberTokens(title).filter((token) => token.includes("/"));
    if (titleFractions.length > 0 && !titleFractions.includes(normalized)) {
      return { level: "conflict", matched: false, strong: false, reason: "different card number in title" };
    }
    if (prefix && boundaryPattern(prefix).test(title)) {
      return { level: "prefixOnly", matched: true, strong: false, reason: `weak prefix ${prefix}` };
    }
  } else if (boundaryPattern(normalized).test(title)) {
    return { level: "exactFraction", matched: true, strong: true, reason: `matched ${normalized}` };
  }

  return { level: "missing", matched: false, strong: false, reason: "card number absent" };
}

export function textIncludesCardNumber(
  text: string,
  cardNumber: string | null | undefined,
  options: { allowPrefixOnly?: boolean } = {},
): boolean {
  const evidence = getCardNumberEvidence(text, cardNumber);
  return evidence.strong || (options.allowPrefixOnly === true && evidence.level === "prefixOnly");
}

function normalizedIncludesTerm(haystack: string, needle: string | null | undefined): boolean {
  const normalizedNeedle = normalizeLookupToken(needle);
  if (!normalizedNeedle) return false;
  const pattern = escapeRegex(normalizedNeedle).replace(/\\ /g, "\\s+");
  return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "i").test(haystack);
}

function nameTokens(value: string | null | undefined): string[] {
  return normalizeLookupToken(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function cardLanguageAllowsForeignTitle(card: ExtractedCard): boolean {
  const lang = normalizeLookupToken(card.language);
  return Boolean(lang && lang !== "english" && lang !== "en" && lang !== "eng");
}

function hasIncompatibleTitle(title: string, card: ExtractedCard): boolean {
  const normalized = normalizeLookupToken(title);
  if (!normalized) return false;
  const cardBlob = normalizeLookupToken([card.set, card.details, card.printStamps, card.language].filter(Boolean).join(" "));
  if (!cardLanguageAllowsForeignTitle(card) && FOREIGN_LANGUAGE_TERMS.some((term) => normalized.includes(term))) {
    return true;
  }
  if (DERIVATIVE_VARIANT_TERMS.some((term) => normalized.includes(term) && !cardBlob.includes(term))) {
    return true;
  }
  if (!cardBlob.includes("1st edition") && /\b1st edition\b|\bfirst edition\b/.test(normalized)) {
    return true;
  }
  return false;
}

export function scoreMarketEvidenceIdentity(
  item: Pick<MarketEvidence, "title" | "slab" | "source">,
  card: ExtractedCard,
): { score: number; reasons: string[]; hardReject: boolean } {
  const text = `${item.slab ?? ""} ${item.title ?? ""}`;
  const normalized = normalizeLookupToken(text);
  const reasons: string[] = [];
  if (!normalized || hasIncompatibleTitle(text, card)) {
    return { score: 0, reasons: ["incompatible title"], hardReject: true };
  }

  const baseName = card.name?.trim() || card.printedName?.trim() || "";
  const setName = card.set?.trim() ?? "";
  const tokens = nameTokens(baseName);
  let score = 0;

  if (baseName && normalizedIncludesTerm(normalized, baseName)) {
    score += 0.45;
    reasons.push("exact name");
  } else {
    const matched = tokens.filter((token) => normalizedIncludesTerm(normalized, token)).length;
    if (matched > 0) reasons.push(`${matched} name tokens`);
    score += Math.min(0.32, matched * 0.1);
  }

  if (setName) {
    const set = normalizeLookupToken(setName);
    const setTokens = set.split(" ").filter((token) => token.length >= 2);
    if (normalizedIncludesTerm(normalized, set)) {
      score += 0.25;
      reasons.push("set");
    } else if (setTokens.some((token) => normalizedIncludesTerm(normalized, token))) {
      score += 0.14;
      reasons.push("set token");
    }
  }

  const numberEvidence = getCardNumberEvidence(text, card.number);
  if (numberEvidence.strong) {
    score += 0.25;
    reasons.push(numberEvidence.reason);
  } else if (numberEvidence.level === "prefixOnly") {
    score += 0.06;
    reasons.push(numberEvidence.reason);
  } else if (numberEvidence.level === "conflict") {
    reasons.push(numberEvidence.reason);
    return { score: 0, reasons, hardReject: true };
  }

  if (card.year && normalizedIncludesTerm(normalized, card.year)) {
    score += 0.05;
    reasons.push("year");
  }

  return { score, reasons, hardReject: false };
}

export function filterMarketEvidenceForCardIdentity(
  items: MarketEvidence[],
  card: ExtractedCard,
): MarketEvidence[] {
  if (!card.name?.trim() && !card.printedName?.trim()) return items;

  const evaluated = items.map((item) => ({
    item,
    result: scoreMarketEvidenceIdentity(item, card),
  }));
  const filtered = evaluated.filter(({ result }) => !result.hardReject).map(({ item }) => item);

  // If all rows were weak but not conflicting, preserve them. Hard conflicts are removed either way.
  return filtered.length > 0 ? filtered : items;
}
