import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { marketDataReady } from "@/lib/scan/sheet-present";

export type SpecimenPipelinePhase = "identity" | "catalog" | "market" | "complete";

export type ScanPresentContext = {
  catalogEnriching?: boolean;
  marketEnriching?: boolean;
};

function hasVisionIdentity(specimen: ScanSpecimen): boolean {
  const name = specimen.card.name?.trim().toLowerCase() ?? "";
  if (!name || name === "—") return false;
  if (/resolving|pending|unknown|registry lookup/i.test(name)) return false;
  return true;
}

function isCatalogSettled(specimen: ScanSpecimen): boolean {
  const { catalogIdentityStatus, catalogId } = specimen.context;
  if (catalogId?.trim()) return true;
  if (catalogIdentityStatus === "confirmed") return true;
  if (catalogIdentityStatus === "ambiguous") return true;
  return false;
}

export function resolveSpecimenPipelinePhase(
  specimen: ScanSpecimen,
  ctx?: ScanPresentContext,
): { phase: SpecimenPipelinePhase; catalogPending: boolean; marketPending: boolean } {
  if (!hasVisionIdentity(specimen)) {
    return { phase: "identity", catalogPending: true, marketPending: false };
  }

  const catalogPending =
    Boolean(ctx?.catalogEnriching) && !isCatalogSettled(specimen);
  if (catalogPending) {
    return { phase: "catalog", catalogPending: true, marketPending: false };
  }

  const marketPending =
    Boolean(ctx?.marketEnriching) && !marketDataReady(specimen);
  if (marketPending) {
    return { phase: "market", catalogPending: false, marketPending: true };
  }

  return { phase: "complete", catalogPending: false, marketPending: false };
}
