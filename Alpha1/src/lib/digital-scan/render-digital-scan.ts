import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  getEffectiveEvidenceCenter,
  getEffectiveEvidenceRadiusMultiplier,
} from "@/hooks/use-scan-session";
import type { DigitalScanRenderPreset } from "@/lib/digital-scan/digital-scan-profile";
import type { DigitalScanAsset, DigitalScanSidecar } from "@/lib/digital-scan/types";
import { buildDigitalScanFilename } from "@/lib/digital-scan/build-filename";
import {
  dataUrlToSha256,
  loadImageElement,
  postProcessScannerCanvas,
} from "@/lib/digital-scan/image-post-process";
import {
  bboxGridToCropRectFloat,
  normalizeVisionBboxGrid,
  type VisionBboxGrid,
} from "@/lib/scan/spatial-grid";
import { visionLocationToCropRectFloat } from "@/lib/scan/specimen-crop";

function resolveCropRect(
  nw: number,
  nh: number,
  center: ReturnType<typeof getEffectiveEvidenceCenter>,
  bbox: VisionBboxGrid | null,
  gradedSlab: boolean,
  radiusMultiplier: number,
  paddingRatio?: number,
) {
  if (bbox) {
    return bboxGridToCropRectFloat(nw, nh, bbox, {
      gradedSlab,
      paddingRatio: paddingRatio ?? (gradedSlab ? 0.05 : 0.06),
    });
  }
  return visionLocationToCropRectFloat(nw, nh, center, {
    gradedSlab,
    radiusMultiplier,
  });
}

export async function renderDigitalScanForSpecimen(args: {
  specimen: ScanSpecimen;
  cardIndexOnPage: number;
  preset: DigitalScanRenderPreset;
  sessionId?: string | null;
  userAdjusted?: boolean;
}): Promise<DigitalScanAsset> {
  const { specimen, cardIndexOnPage, preset, sessionId, userAdjusted } = args;
  const lane = specimen.context.lane;
  const gradedSlab = lane === "graded";
  const center = getEffectiveEvidenceCenter(specimen);
  const radiusMultiplier = getEffectiveEvidenceRadiusMultiplier(specimen);
  const bbox = normalizeVisionBboxGrid(specimen.card.bbox) ?? null;
  const ext = preset.mime === "image/png" ? "png" : "jpg";
  const filename = buildDigitalScanFilename({
    index: cardIndexOnPage,
    card: specimen.card,
    context: specimen.context,
    ext,
  });

  const baseSidecar: DigitalScanSidecar = {
    pgtVersion: "1",
    catalogId: specimen.context.catalogId ?? null,
    name: specimen.card.name,
    set: specimen.card.set ?? null,
    number: specimen.card.number ?? null,
    year: specimen.card.year ?? specimen.context.year ?? null,
    rarity: specimen.card.rarity ?? null,
    grader: specimen.card.grader ?? null,
    grade: specimen.card.grade ?? null,
    cert: specimen.card.cert ?? null,
    fmvUsd: specimen.context.fairValueUsd ?? null,
    fairValueBasis: specimen.context.fairValueBasis ?? null,
    sourceSession: sessionId ?? null,
    cropMethod: bbox ? "bbox" : "center",
    contentSha256: null,
    attestationNote:
      "PGT Digital Scan — image hash attests to this crop at render time; FMV is indicative from market comps.",
  };

  if (!specimen.previewUrl) {
    return {
      specimenId: specimen.id,
      cardIndexOnPage,
      lane,
      filename,
      dataUrl: "",
      mime: preset.mime,
      width: 0,
      height: 0,
      crop: { bbox, center, radiusMultiplier },
      sidecar: baseSidecar,
      status: "failed",
      error: "Source photo unavailable — re-upload to generate digital scans.",
      renderedAt: new Date().toISOString(),
    };
  }

  try {
    const img = await loadImageElement(specimen.previewUrl);
    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    const rect = resolveCropRect(
      nw,
      nh,
      center,
      bbox,
      gradedSlab,
      radiusMultiplier,
      preset.paddingRatio,
    );
    const scale = Math.min(1, preset.maxOutputSide / Math.max(rect.sw, rect.sh));
    const outW = Math.max(1, Math.round(rect.sw * scale));
    const outH = Math.max(1, Math.round(rect.sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outW, outH);

    await postProcessScannerCanvas(canvas, {
      normalizeContrast: preset.normalizeContrast,
      borderPx: preset.borderPx,
    });

    const dataUrl =
      preset.mime === "image/png"
        ? canvas.toDataURL("image/png")
        : canvas.toDataURL("image/jpeg", preset.quality);

    const contentSha256 = await dataUrlToSha256(dataUrl);

    return {
      specimenId: specimen.id,
      cardIndexOnPage,
      lane,
      filename,
      dataUrl,
      mime: preset.mime,
      width: outW,
      height: outH,
      crop: { bbox, center, radiusMultiplier },
      sidecar: { ...baseSidecar, contentSha256 },
      status: userAdjusted ? "user_adjusted" : "ready",
      renderedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      specimenId: specimen.id,
      cardIndexOnPage,
      lane,
      filename,
      dataUrl: "",
      mime: preset.mime,
      width: 0,
      height: 0,
      crop: { bbox, center, radiusMultiplier },
      sidecar: baseSidecar,
      status: "failed",
      error: err instanceof Error ? err.message : "Render failed",
      renderedAt: new Date().toISOString(),
    };
  }
}

export function patchDigitalScanSidecarFromSpecimen(
  asset: DigitalScanAsset,
  specimen: ScanSpecimen,
  sessionId?: string | null,
): DigitalScanAsset {
  return {
    ...asset,
    sidecar: {
      ...asset.sidecar,
      catalogId: specimen.context.catalogId ?? asset.sidecar.catalogId,
      name: specimen.card.name,
      set: specimen.card.set ?? asset.sidecar.set,
      number: specimen.card.number ?? asset.sidecar.number,
      year: specimen.card.year ?? specimen.context.year ?? asset.sidecar.year,
      rarity: specimen.card.rarity ?? asset.sidecar.rarity,
      grader: specimen.card.grader ?? asset.sidecar.grader,
      grade: specimen.card.grade ?? asset.sidecar.grade,
      cert: specimen.card.cert ?? asset.sidecar.cert,
      fmvUsd: specimen.context.fairValueUsd ?? asset.sidecar.fmvUsd,
      fairValueBasis: specimen.context.fairValueBasis ?? asset.sidecar.fairValueBasis,
      sourceSession: sessionId ?? asset.sidecar.sourceSession,
    },
  };
}
