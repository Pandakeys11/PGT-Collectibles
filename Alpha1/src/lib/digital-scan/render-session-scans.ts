import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  getDigitalScanPreset,
  readDigitalScanPngExport,
} from "@/lib/digital-scan/digital-scan-profile";
import {
  patchDigitalScanSidecarFromSpecimen,
  renderDigitalScanForSpecimen,
} from "@/lib/digital-scan/render-digital-scan";
import type { DigitalScanAsset, DigitalScanProgress } from "@/lib/digital-scan/types";

export async function renderDigitalScansForSession(args: {
  specimens: ScanSpecimen[];
  isPro: boolean;
  sessionId?: string | null;
  preferPng?: boolean;
  onProgress?: (progress: DigitalScanProgress) => void;
  /** Re-render only these specimen ids */
  onlySpecimenIds?: Set<string>;
  existingAssets?: Record<string, DigitalScanAsset>;
}): Promise<Record<string, DigitalScanAsset>> {
  const {
    specimens,
    isPro,
    sessionId,
    preferPng = readDigitalScanPngExport(),
    onProgress,
    onlySpecimenIds,
    existingAssets = {},
  } = args;

  const total = onlySpecimenIds
    ? specimens.filter((s) => onlySpecimenIds.has(s.id)).length
    : specimens.length;
  let done = 0;
  const out: Record<string, DigitalScanAsset> = { ...existingAssets };

  for (let i = 0; i < specimens.length; i += 1) {
    const specimen = specimens[i]!;
    if (onlySpecimenIds && !onlySpecimenIds.has(specimen.id)) continue;

    onProgress?.({
      done,
      total,
      currentLabel: specimen.card.name || `Card ${i + 1}`,
    });

    const preset = getDigitalScanPreset(specimen.context.lane, isPro, preferPng);
    const cardIndexOnPage = out[specimen.id]?.cardIndexOnPage ?? i + 1;
    const asset = await renderDigitalScanForSpecimen({
      specimen,
      cardIndexOnPage,
      preset,
      sessionId,
      userAdjusted: Boolean(onlySpecimenIds?.has(specimen.id)),
    });
    out[specimen.id] = asset;
    done += 1;
    onProgress?.({ done, total, currentLabel: specimen.card.name });
  }

  return out;
}

export function refreshDigitalScanSidecars(
  assets: Record<string, DigitalScanAsset>,
  specimens: ScanSpecimen[],
  sessionId?: string | null,
): Record<string, DigitalScanAsset> {
  const next = { ...assets };
  for (const specimen of specimens) {
    const existing = next[specimen.id];
    if (!existing || existing.status === "failed") continue;
    next[specimen.id] = patchDigitalScanSidecarFromSpecimen(existing, specimen, sessionId);
  }
  return next;
}
