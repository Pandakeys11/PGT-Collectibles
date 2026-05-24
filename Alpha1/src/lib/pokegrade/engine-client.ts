/**
 * PokeGrade Engine integration layer.
 *
 * PokeGrade.AI advertises a "Grading Engine API" (see pokegrade.ai footer) but does not
 * publish public OpenAPI docs in-repo. When `POKEGRADE_API_URL` + `POKEGRADE_API_KEY` are
 * configured, we attempt their grade endpoint; otherwise Liquid Scan uses the native PGT
 * vision + market pipeline (same data users see in the scan sheet).
 */

import type { PokeGradeHudSnapshot } from "@/lib/pokegrade/types";

export type PokeGradeEngineRequest = {
  imageBase64: string;
  mimeType: string;
};

export type PokeGradeEngineResponse = {
  ok: boolean;
  hud?: Partial<PokeGradeHudSnapshot>;
  error?: string;
};

function pokeGradeConfigured(): boolean {
  return Boolean(
    process.env.POKEGRADE_API_URL?.trim() && process.env.POKEGRADE_API_KEY?.trim(),
  );
}

/**
 * Optional remote PokeGrade Engine call (server route should proxy this in production).
 * Client-side: returns null so callers use PGT pipeline.
 */
export async function tryPokeGradeEngine(
  _req: PokeGradeEngineRequest,
): Promise<PokeGradeEngineResponse | null> {
  if (typeof window !== "undefined") {
    return null;
  }
  if (!pokeGradeConfigured()) return null;

  const base = process.env.POKEGRADE_API_URL!.replace(/\/$/, "");
  const key = process.env.POKEGRADE_API_KEY!;

  try {
    const res = await fetch(`${base}/grade`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        image: _req.imageBase64,
        mimeType: _req.mimeType,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: String(data.error ?? `PokeGrade API ${res.status}`) };
    }
    return {
      ok: true,
      hud: {
        cardName: typeof data.cardName === "string" ? data.cardName : undefined,
        subtitle: typeof data.set === "string" ? data.set : undefined,
        gradeLine:
          typeof data.grade === "string"
            ? data.grade
            : typeof data.estimatedGrade === "string"
              ? data.estimatedGrade
              : undefined,
        fairValueUsd:
          typeof data.marketValue === "number"
            ? data.marketValue
            : typeof data.fairValueUsd === "number"
              ? data.fairValueUsd
              : undefined,
        psa10SoldUsd:
          typeof data.psa10Value === "number" ? data.psa10Value : undefined,
        provider: "pokegrade",
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "PokeGrade Engine unreachable",
    };
  }
}

export function pokeGradeEngineEnabled(): boolean {
  return pokeGradeConfigured();
}
