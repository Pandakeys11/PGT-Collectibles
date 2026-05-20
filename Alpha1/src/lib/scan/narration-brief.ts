import { buildLocalStructuredBrief } from "@/lib/scan/local-brief";
import type { ScanCardContext, StructuredBrief } from "@/lib/scan/schemas";
import { structuredBriefSchema } from "@/lib/scan/schemas";

export const NARRATION_TODAY_ISO = new Date().toISOString().slice(0, 10);

/** LLM writes narrative only — verification and comps are injected from session context. */
export const NARRATION_SYSTEM = `You are a senior Pokémon TCG market analyst writing a **research desk brief**.

Today's date: ${NARRATION_TODAY_ISO} (UTC). Use only for framing recency — do not invent sale dates.

Rules:
- Use ONLY facts in the JSON context (extraction, catalog, in-session marketEvidence, FMV, hubs).
- Never invent prices, URLs, populations, or comps not present in context.
- Keep prose tight: summary ≤ 4 sentences; marketSnapshot ≤ 3 sentences; compAnalysis ≤ 6 short bullets or one paragraph; valuation ≤ 3 sentences; nextChecks = 3–5 imperatives (no URLs).
- Do not repeat raw JSON. Do not include markdown code fences.

Return a single JSON object with EXACTLY these keys (all strings except nextChecks array):
summary, marketSnapshot, compAnalysis, valuation, nextChecks

Example shape:
{"summary":"...","marketSnapshot":"...","compAnalysis":"• ...\\n• ...","valuation":"...","nextChecks":["...","..."]}`;

const NARRATIVE_KEYS = ["summary", "marketSnapshot", "compAnalysis", "valuation"] as const;

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  if (start >= 0) return trimmed.slice(start);
  return trimmed;
}

function closeTruncatedBriefJson(payload: string): string[] {
  const trimmed = payload.trim();
  const attempts: string[] = [];

  const lastStringEnd = trimmed.lastIndexOf('",');
  if (lastStringEnd > 0) {
    attempts.push(`${trimmed.slice(0, lastStringEnd + 1)}}`);
  }

  const lastClosedString = trimmed.match(/^(.*"[^"]+"\s*:\s*"(?:[^"\\]|\\.)*")\s*$/);
  if (lastClosedString?.[1]) {
    attempts.push(`${lastClosedString[1]}"}`);
  }

  if (!trimmed.endsWith("}")) {
    attempts.push(`${trimmed}}`);
  }

  return [...new Set(attempts)];
}

function extractStringField(payload: string, key: string): string | null {
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = payload.match(re);
  if (!match?.[1]) return null;
  return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim() || null;
}

function extractNextChecks(payload: string): string[] | null {
  const re = /"nextChecks"\s*:\s*\[([\s\S]*?)\]/;
  const match = payload.match(re);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(`[${match[1]}]`) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function parseNarrativeObject(raw: Record<string, unknown>): Partial<StructuredBrief> {
  const partial: Partial<StructuredBrief> = {};
  for (const key of NARRATIVE_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      partial[key] = value.trim();
    }
  }
  if (Array.isArray(raw.nextChecks)) {
    partial.nextChecks = raw.nextChecks.map((item) => String(item).trim()).filter(Boolean);
  }
  return partial;
}

export function mergeNarrativeIntoBrief(
  base: StructuredBrief,
  narrative: Partial<StructuredBrief>,
): StructuredBrief {
  return {
    summary: narrative.summary?.trim() || base.summary,
    marketSnapshot: narrative.marketSnapshot?.trim() || base.marketSnapshot,
    compAnalysis: narrative.compAnalysis?.trim() || base.compAnalysis,
    valuation: narrative.valuation?.trim() || base.valuation,
    verification: base.verification,
    gradedSupply: base.gradedSupply,
    marketEvidence: base.marketEvidence,
    nextChecks:
      narrative.nextChecks && narrative.nextChecks.length > 0 ? narrative.nextChecks : base.nextChecks,
  };
}

export type ParseNarrationBriefResult =
  | { ok: true; brief: StructuredBrief; salvaged: boolean; source: "llm" | "llm_partial" }
  | { ok: false; reason: string };

export function parseNarrationBriefFromLlm(
  raw: string,
  context: ScanCardContext,
  base?: StructuredBrief,
): ParseNarrationBriefResult {
  const sessionBase = base ?? buildLocalStructuredBrief(context);
  const payload = extractJsonPayload(raw);
  if (!payload) {
    return { ok: false, reason: "empty model output" };
  }

  const attempts = [payload, ...closeTruncatedBriefJson(payload)];
  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const narrative = parseNarrativeObject(parsed);
      if (!narrative.summary && !narrative.marketSnapshot && !narrative.valuation) continue;
      const merged = mergeNarrativeIntoBrief(sessionBase, narrative);
      const validated = structuredBriefSchema.safeParse(merged);
      if (validated.success) {
        return {
          ok: true,
          brief: validated.data,
          salvaged: candidate !== payload,
          source: candidate === payload ? "llm" : "llm_partial",
        };
      }
    } catch {
      // try next repair
    }
  }

  const regexNarrative: Partial<StructuredBrief> = {};
  for (const key of NARRATIVE_KEYS) {
    const value = extractStringField(payload, key);
    if (value?.trim()) regexNarrative[key] = value.trim();
  }
  const checks = extractNextChecks(payload);
  if (checks?.length) regexNarrative.nextChecks = checks;

  if (regexNarrative.summary || regexNarrative.marketSnapshot || regexNarrative.valuation) {
    const merged = mergeNarrativeIntoBrief(sessionBase, regexNarrative);
    const validated = structuredBriefSchema.safeParse(merged);
    if (validated.success) {
      return { ok: true, brief: validated.data, salvaged: true, source: "llm_partial" };
    }
  }

  return { ok: false, reason: "could not parse narration JSON" };
}

export function buildSessionBrief(context: ScanCardContext): StructuredBrief {
  const brief = buildLocalStructuredBrief(context);
  const validated = structuredBriefSchema.safeParse(brief);
  return validated.success ? validated.data : brief;
}
