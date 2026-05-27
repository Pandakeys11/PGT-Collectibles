import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate, ScanCardContext } from "@/lib/scan/schemas";
import { hasUserCatalogOverride } from "@/lib/scan/catalog-merge";

/** Top catalog row the user is reviewing (active lock or best remaining candidate). */
export function getActiveCatalogCandidate(
  context: ScanCardContext,
): CatalogCandidate | null {
  const { catalogId, catalogCandidates } = context;
  if (catalogCandidates.length === 0) return null;
  if (catalogId) {
    return (
      catalogCandidates.find((row) => row.catalogId === catalogId) ??
      catalogCandidates[0] ??
      null
    );
  }
  return catalogCandidates[0] ?? null;
}

export function catalogQuickPickVisible(specimen: ScanSpecimen): boolean {
  if (hasUserCatalogOverride(specimen.context)) return false;
  if (specimen.context.catalogCandidates.length > 0) return true;
  const status = specimen.context.catalogIdentityStatus;
  if (status === "confirmed" && specimen.context.verificationStatus === "verified") {
    return false;
  }
  return status !== "confirmed";
}

export function catalogQuickPickRank(
  context: ScanCardContext,
  candidate: CatalogCandidate,
): number {
  const index = context.catalogCandidates.findIndex(
    (row) => row.catalogId === candidate.catalogId,
  );
  return index >= 0 ? index + 1 : 1;
}
