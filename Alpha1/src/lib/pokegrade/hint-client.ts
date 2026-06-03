import type { PokeGradeHudSnapshot } from "@/lib/pokegrade/types";
import { extractedCardSchema, type ExtractedCard } from "@/lib/scan/schemas";

export type PokeGradeIdentityHint = {
  name?: string;
  set?: string;
  number?: string;
  gradeLine?: string | null;
  fairValueUsd?: number | null;
};

const UNKNOWN_NAME = /^unknown|resolving identity$/i;
const WEAK_SET = /^unknown|pending$/i;

const POKEGRADE_HINT_TIMEOUT_MS = 12_000;

function parseSetSubtitle(subtitle?: string): Pick<PokeGradeIdentityHint, "set" | "number"> {
  if (!subtitle?.trim()) return {};
  const segments = subtitle
    .split(/[·•|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (segments.length === 0) return {};

  const set = segments[0];
  let number: string | undefined;
  for (const segment of segments.slice(1)) {
    const slashMatch = segment.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (slashMatch) {
      number = slashMatch[1];
      break;
    }
    if (/^[A-Za-z]{0,4}\d+[A-Za-z]?$/.test(segment.replace(/\s/g, ""))) {
      number = segment;
      break;
    }
  }
  return { set, number };
}

/** Optional fast identity hint from PokeGrade Engine (parallel with vision). */
export async function fetchPokeGradeHint(
  evidenceUrl: string,
): Promise<PokeGradeIdentityHint | null> {
  if (typeof window === "undefined") return null;

  const comma = evidenceUrl.indexOf(",");
  if (comma < 0) return null;

  const base64 = evidenceUrl.slice(comma + 1);
  const mimeType = evidenceUrl.match(/^data:([^;]+)/)?.[1] ?? "image/jpeg";

  try {
    const res = await fetch("/api/pokegrade/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
      signal: AbortSignal.timeout(POKEGRADE_HINT_TIMEOUT_MS),
    });
    if (res.status === 503) return null;
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      hud?: Partial<PokeGradeHudSnapshot>;
    };
    if (!data.ok || !data.hud?.cardName?.trim()) return null;

    const parsed = parseSetSubtitle(data.hud.subtitle);
    return {
      name: data.hud.cardName.trim(),
      set: parsed.set,
      number: parsed.number,
      gradeLine: data.hud.gradeLine ?? null,
      fairValueUsd: data.hud.fairValueUsd ?? null,
    };
  } catch {
    return null;
  }
}

/** Fill only missing identity fields — vision OCR stays authoritative when strong. */
export function mergePokeGradeHint(
  card: ExtractedCard,
  hint: PokeGradeIdentityHint,
): ExtractedCard {
  const name =
    card.name?.trim() && !UNKNOWN_NAME.test(card.name)
      ? card.name
      : (hint.name ?? card.name);
  const set =
    card.set?.trim() && !WEAK_SET.test(card.set) ? card.set : (hint.set ?? card.set);
  const number = card.number?.trim() ? card.number : (hint.number ?? card.number);

  return extractedCardSchema.parse({
    ...card,
    name,
    set,
    number,
  });
}
