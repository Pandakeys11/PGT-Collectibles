/**
 * Parse vision model text into a `cards` array. Models often wrap JSON in fences,
 * truncate mid-string on large binder pages, or emit slightly invalid JSON.
 */

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();

  const cardsKey = trimmed.indexOf('{"cards"');
  if (cardsKey >= 0) return trimmed.slice(cardsKey);

  const altKey = trimmed.indexOf('"cards"');
  if (altKey >= 0) {
    const brace = trimmed.lastIndexOf("{", altKey);
    if (brace >= 0) return trimmed.slice(brace);
  }

  return trimmed;
}

function cardsFromParsedRoot(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== "object") return [];
  const cards = (parsed as { cards?: unknown }).cards;
  return Array.isArray(cards) ? cards : [];
}

/** Walk the `cards` array and JSON.parse each complete top-level object (handles truncation). */
export function salvageCompleteCardObjects(payload: string): unknown[] {
  const cardsKey = payload.indexOf('"cards"');
  if (cardsKey < 0) return [];

  const bracketStart = payload.indexOf("[", cardsKey);
  if (bracketStart < 0) return [];

  const cards: unknown[] = [];
  let i = bracketStart + 1;

  while (i < payload.length) {
    while (i < payload.length && /[\s,]/.test(payload[i]!)) i += 1;
    if (i >= payload.length) break;
    if (payload[i] === "]") break;
    if (payload[i] !== "{") break;

    const objStart = i;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (; i < payload.length; i += 1) {
      const c = payload[i]!;
      if (inString) {
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') {
        inString = true;
        continue;
      }
      if (c === "{") depth += 1;
      if (c === "}") {
        depth -= 1;
        if (depth === 0) {
          const slice = payload.slice(objStart, i + 1);
          try {
            const obj = JSON.parse(slice) as unknown;
            if (obj && typeof obj === "object") cards.push(obj);
          } catch {
            // skip malformed object
          }
          i += 1;
          break;
        }
      }
    }

    if (depth !== 0) break;
  }

  return cards;
}

function closeTruncatedCardsWrapper(payload: string): string[] {
  const attempts: string[] = [];
  const trimmed = payload.trim();

  const lastObjComma = trimmed.lastIndexOf("},");
  if (lastObjComma > 0) {
    attempts.push(`${trimmed.slice(0, lastObjComma + 1)}]}`);
  }

  const lastObj = trimmed.lastIndexOf("}");
  if (lastObj > 0) {
    attempts.push(`${trimmed.slice(0, lastObj + 1)}]}`);
  }

  attempts.push(`${trimmed}]}`);
  return attempts;
}

export type ParseVisionCardsResult = {
  cards: unknown[];
  salvaged: boolean;
};

export function parseVisionCardsFromText(text: string): ParseVisionCardsResult {
  const payload = extractJsonPayload(text);
  if (!payload) return { cards: [], salvaged: false };

  try {
    const parsed = JSON.parse(payload) as unknown;
    const cards = cardsFromParsedRoot(parsed);
    if (cards.length > 0) return { cards, salvaged: false };
  } catch {
    // fall through to repair
  }

  for (const repaired of closeTruncatedCardsWrapper(payload)) {
    try {
      const parsed = JSON.parse(repaired) as unknown;
      const cards = cardsFromParsedRoot(parsed);
      if (cards.length > 0) return { cards, salvaged: true };
    } catch {
      // try next repair
    }
  }

  const salvaged = salvageCompleteCardObjects(payload);
  if (salvaged.length > 0) return { cards: salvaged, salvaged: true };

  throw new Error("Could not parse vision JSON (truncated or invalid model output)");
}
