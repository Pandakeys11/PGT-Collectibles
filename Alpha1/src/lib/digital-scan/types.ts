import type { VisionGridLocation } from "@/lib/scan/spatial";
import type { VisionBboxGrid } from "@/lib/scan/spatial-grid";

export type DigitalScanLane = "raw" | "graded";

export type DigitalScanSidecar = {
  pgtVersion: "1";
  catalogId: string | null;
  name: string;
  set: string | null;
  number: string | null;
  year: string | null;
  rarity: string | null;
  grader: string | null;
  grade: string | null;
  cert: string | null;
  fmvUsd: number | null;
  fairValueBasis: string | null;
  sourceSession: string | null;
  cropMethod: "bbox" | "center";
  contentSha256: string | null;
  attestationNote: string;
};

export type DigitalScanAsset = {
  specimenId: string;
  cardIndexOnPage: number;
  lane: DigitalScanLane;
  filename: string;
  dataUrl: string;
  mime: "image/jpeg" | "image/png";
  width: number;
  height: number;
  crop: {
    bbox: VisionBboxGrid | null;
    center: VisionGridLocation;
    radiusMultiplier: number;
  };
  sidecar: DigitalScanSidecar;
  status: "pending" | "ready" | "failed" | "user_adjusted";
  error?: string;
  renderedAt: string;
};

export type DigitalScanProgress = {
  done: number;
  total: number;
  currentLabel?: string;
};

export type DigitalScanManifest = {
  pgtVersion: "1";
  sessionTitle: string;
  sessionId: string | null;
  createdAt: string;
  cardCount: number;
  assets: Array<{
    index: number;
    filename: string;
    sidecarFilename: string;
    specimenId: string;
    name: string;
    catalogId: string | null;
  }>;
};

export type ScanVaultRow = {
  id: string;
  sessionId: string | null;
  filename: string;
  mime: string;
  width: number | null;
  height: number | null;
  cardIndexOnPage: number | null;
  lane: string;
  catalogId: string | null;
  sidecar: Record<string, unknown>;
  createdAt: string;
  publicUrl: string | null;
  name: string;
};
