import type { CatalogMatch } from "@/lib/market/pokemon-catalog";
import { MIN_CATALOG_PICK_OPTIONS } from "@/lib/market/ensure-catalog-options";
import type { ExtractedCard } from "@/lib/scan/schemas";

export type CatalogEnrichTelemetry = {
  specimenId: string;
  franchise: string;
  catalogIdentityStatus: string;
  catalogConfidence: number;
  candidateCount: number;
  topScore: number | null;
  topGap: number | null;
  pickOptionsSufficient: boolean;
  catalogId: string | null;
};

export function buildCatalogEnrichTelemetry(
  specimenId: string,
  card: ExtractedCard,
  catalog: CatalogMatch | null,
): CatalogEnrichTelemetry {
  const candidates = catalog?.candidates ?? [];
  const top = candidates[0];
  const runner = candidates[1];
  return {
    specimenId,
    franchise: (card.franchise ?? "pokemon").toString(),
    catalogIdentityStatus: catalog?.catalogIdentityStatus ?? "failed",
    catalogConfidence: catalog?.catalogConfidence ?? 0,
    candidateCount: candidates.length,
    topScore: top?.score ?? catalog?.score ?? null,
    topGap:
      top && runner
        ? top.score - runner.score
        : top
          ? top.score
          : null,
    pickOptionsSufficient: candidates.length >= MIN_CATALOG_PICK_OPTIONS,
    catalogId: catalog?.catalogId ?? null,
  };
}

/** Dev / ops logging for catalog regressions (Loki, Vercel logs, etc.). */
export function logCatalogEnrichTelemetry(row: CatalogEnrichTelemetry): void {
  if (process.env.CATALOG_ENRICH_TELEMETRY !== "1") return;
  console.info("[catalog-enrich]", JSON.stringify(row));
}
