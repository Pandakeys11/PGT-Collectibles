import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { buildPrintIdentitySnapshot } from "@/lib/scan/print-identity-ui";

export type FmvReadiness =
  | { ready: true }
  | { ready: false; reason: "catalog" | "print" | "both"; message: string };

/**
 * Whether headline FMV should be shown as trusted for this specimen.
 * Catalog + print identity must be settled before we present a single dollar answer.
 */
export function assessFmvReadiness(specimen: ScanSpecimen): FmvReadiness {
  const catalogOk =
    specimen.context.catalogIdentityStatus === "confirmed" ||
    specimen.context.verificationStatus === "verified";

  const printSnap = buildPrintIdentitySnapshot(specimen);
  const printOk = printSnap.status !== "needs_confirm";

  if (catalogOk && printOk) return { ready: true };

  const needsCatalog = !catalogOk;
  const needsPrint = !printOk;

  if (needsCatalog && needsPrint) {
    return {
      ready: false,
      reason: "both",
      message: "Confirm catalog match and print run before FMV.",
    };
  }
  if (needsCatalog) {
    return {
      ready: false,
      reason: "catalog",
      message: "Confirm catalog match before FMV.",
    };
  }
  return {
    ready: false,
    reason: "print",
    message: printSnap.blocker ?? "Confirm print run before FMV.",
  };
}
