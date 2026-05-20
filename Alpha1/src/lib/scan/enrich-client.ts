import { readResponseJson } from "@/lib/http/read-response-json";
import type { ExtractedCard, ScanCardContext } from "@/lib/scan/schemas";

export type EnrichPhase = "full" | "catalog" | "market";

/** Drop in-memory enrich + Pokédex API caches (call on Clear session / new scan). */
export async function flushRuntimeCaches(): Promise<void> {
  try {
    await fetch("/api/scan/flush-caches", { method: "POST", cache: "no-store" });
  } catch {
    // Non-fatal if the server is unreachable.
  }
}

const TRANSIENT_ENRICH_STATUSES = new Set([404, 408, 429, 500, 502, 503, 504]);

function enrichBackoffMs(attempt: number): number {
  return 400 * (attempt + 1);
}

export async function enrichExtractedCard(args: {
  specimenId: string;
  card: ExtractedCard;
  phase?: EnrichPhase;
  catalogId?: string | null;
  catalogImageUrl?: string | null;
  /** After resync, bypass market cache so identity/comps refresh for the new extraction. */
  skipCache?: boolean;
}): Promise<{
  card: ExtractedCard;
  context: ScanCardContext;
  catalogMatched?: boolean;
  catalogId?: string | null;
}> {
  const phase = args.phase ?? "full";
  const timeoutMs = phase === "catalog" ? 25_000 : phase === "market" ? 60_000 : 45_000;
  const maxAttempts = 3;

  let lastError = "Enrichment failed";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, enrichBackoffMs(attempt - 1)));
    }

    let response: Response;
    try {
      response = await fetch("/api/scan/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Enrichment request failed";
      if (attempt < maxAttempts - 1) continue;
      throw new Error(lastError);
    }

    const data = await readResponseJson<{
      card?: ExtractedCard;
      context?: ScanCardContext;
      catalogMatched?: boolean;
      catalogId?: string | null;
      error?: string;
    }>(response);

    if (response.ok && data.card && data.context) {
      return {
        card: data.card,
        context: data.context,
        catalogMatched: data.catalogMatched,
        catalogId: data.catalogId ?? null,
      };
    }

    lastError = data.error || `Enrichment failed (${response.status})`;
    if (TRANSIENT_ENRICH_STATUSES.has(response.status) && attempt < maxAttempts - 1) {
      continue;
    }
    break;
  }

  throw new Error(lastError);
}
