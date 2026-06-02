import JSZip from "jszip";
import type { DigitalScanAsset, DigitalScanManifest } from "@/lib/digital-scan/types";

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Invalid data URL");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function buildDigitalScanManifest(args: {
  assets: DigitalScanAsset[];
  sessionTitle: string;
  sessionId?: string | null;
}): DigitalScanManifest {
  const sorted = [...args.assets].sort((a, b) => a.cardIndexOnPage - b.cardIndexOnPage);
  return {
    pgtVersion: "1",
    sessionTitle: args.sessionTitle,
    sessionId: args.sessionId ?? null,
    createdAt: new Date().toISOString(),
    cardCount: sorted.filter((a) => a.status === "ready" || a.status === "user_adjusted").length,
    assets: sorted
      .filter((a) => a.status === "ready" || a.status === "user_adjusted")
      .map((a) => ({
        index: a.cardIndexOnPage,
        filename: a.filename,
        sidecarFilename: a.filename.replace(/\.(jpg|jpeg|png)$/i, ".json"),
        specimenId: a.specimenId,
        name: a.sidecar.name,
        catalogId: a.sidecar.catalogId,
      })),
  };
}

export async function buildDigitalScanZip(args: {
  assets: DigitalScanAsset[];
  sessionTitle: string;
  sessionId?: string | null;
  includeAttestationPack?: boolean;
}): Promise<Blob> {
  const zip = new JSZip();
  const folderName = `digital-scans-${timestampSlug()}`;
  const root = zip.folder(folderName);
  if (!root) throw new Error("ZIP folder failed");

  const ready = [...args.assets]
    .filter((a) => a.status === "ready" || a.status === "user_adjusted")
    .sort((a, b) => a.cardIndexOnPage - b.cardIndexOnPage);

  for (const asset of ready) {
    if (!asset.dataUrl) continue;
    root.file(asset.filename, dataUrlToUint8Array(asset.dataUrl));
    const sidecarName = asset.filename.replace(/\.(jpg|jpeg|png)$/i, ".json");
    root.file(sidecarName, JSON.stringify(asset.sidecar, null, 2));
  }

  const manifest = buildDigitalScanManifest({
    assets: args.assets,
    sessionTitle: args.sessionTitle,
    sessionId: args.sessionId,
  });
  root.file("manifest.json", JSON.stringify(manifest, null, 2));

  if (args.includeAttestationPack) {
    const attestation = {
      pgtVersion: "1",
      type: "pgt-digital-scan-attestation",
      sessionId: args.sessionId ?? null,
      sessionTitle: args.sessionTitle,
      createdAt: manifest.createdAt,
      cards: ready.map((a) => ({
        index: a.cardIndexOnPage,
        filename: a.filename,
        catalogId: a.sidecar.catalogId,
        name: a.sidecar.name,
        set: a.sidecar.set,
        number: a.sidecar.number,
        grade: a.sidecar.grade,
        grader: a.sidecar.grader,
        cert: a.sidecar.cert,
        fmvUsd: a.sidecar.fmvUsd,
        fairValueBasis: a.sidecar.fairValueBasis,
        contentSha256: a.sidecar.contentSha256,
      })),
    };
    root.file("attestation-pack.json", JSON.stringify(attestation, null, 2));
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function downloadDigitalScanZip(args: {
  assets: DigitalScanAsset[];
  sessionTitle: string;
  sessionId?: string | null;
  includeAttestationPack?: boolean;
}): Promise<void> {
  const blob = await buildDigitalScanZip(args);
  const slug = timestampSlug();
  downloadBlob(`pgt-digital-scans-${slug}.zip`, blob);
}

export function downloadSingleDigitalScan(asset: DigitalScanAsset): void {
  if (!asset.dataUrl || asset.status === "failed") return;
  const bytes = dataUrlToUint8Array(asset.dataUrl);
  const blob = new Blob([new Uint8Array(bytes)], { type: asset.mime });
  downloadBlob(asset.filename, blob);
}

export function downloadDigitalScanSidecar(asset: DigitalScanAsset): void {
  const sidecarName = asset.filename.replace(/\.(jpg|jpeg|png)$/i, ".json");
  const blob = new Blob([JSON.stringify(asset.sidecar, null, 2)], { type: "application/json" });
  downloadBlob(sidecarName, blob);
}
