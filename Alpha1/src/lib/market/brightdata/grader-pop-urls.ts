import type { CatalogCardSummary } from "@/lib/catalog/catalog-types";
import { buildRegistryUrl } from "@/lib/market/cert-lookup";

export type GraderId = "PSA" | "BGS" | "CGC";

/** PSA cert page — includes grade pop line for the slab grade. */
export function buildPsaCertUrl(certNumber: string): string {
  return buildRegistryUrl("PSA", certNumber);
}

/** PSA TCG pop report landing (search / browse). */
export function buildPsaTcgPopBrowseUrl(): string {
  return "https://www.psacard.com/pop/tcg-cards/";
}

/**
 * PSA pop item when spec id is known (from cert lookup / Apify).
 * Example: https://www.psacard.com/pop/tcg-cards/.../306946
 */
export function buildPsaPopItemUrl(specId: string | number): string {
  const id = String(specId).replace(/\D/g, "");
  return `https://www.psacard.com/pop/tcg-cards/item/${id}`;
}

/** BGS population report search. */
export function buildBgsPopSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.beckett.com/grading/pop-report?search=${q}`;
}

/** CGC census search. */
export function buildCgcCensusSearchUrl(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.cgccards.com/population-report/search?q=${q}`;
}

export function buildGraderCertUrl(grader: GraderId, certNumber: string): string {
  return buildRegistryUrl(grader, certNumber);
}

/** URLs to harvest for a catalog card (ordered: most specific first). */
export function buildCatalogPopHarvestUrls(
  card: CatalogCardSummary,
  options?: { psaSpecId?: string | number | null },
): { grader: GraderId; url: string; label: string }[] {
  const identity = [card.name, card.set?.name, card.number].filter(Boolean).join(" ");
  const out: { grader: GraderId; url: string; label: string }[] = [];

  if (options?.psaSpecId) {
    out.push({
      grader: "PSA",
      url: buildPsaPopItemUrl(options.psaSpecId),
      label: "PSA pop item (spec id)",
    });
  }

  out.push(
    {
      grader: "PSA",
      url: buildPsaTcgPopBrowseUrl(),
      label: "PSA TCG pop browse",
    },
    {
      grader: "BGS",
      url: buildBgsPopSearchUrl(identity),
      label: "BGS pop search",
    },
    {
      grader: "CGC",
      url: buildCgcCensusSearchUrl(identity),
      label: "CGC census search",
    },
  );

  return out;
}
