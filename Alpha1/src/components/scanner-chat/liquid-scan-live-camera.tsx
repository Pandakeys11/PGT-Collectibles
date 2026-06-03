"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Scan,
  Plus,
  Camera,
  Zap,
  ImagePlus,
  Radio,
  Aperture,
  BookmarkPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveScanResultSheet } from "@/components/scanner-chat/live-scan-result-sheet";
import { PgtHelmetHudOverlay } from "@/components/scanner-chat/pgt-helmet-hud-overlay";
import { useLiveCameraAnalysis } from "@/hooks/use-live-camera-analysis";
import { useLiveCameraGuide } from "@/hooks/use-live-camera-guide";
import type { ScanLaneMode } from "@/hooks/use-scan-session";
import {
  patchLiquidCameraPrefs,
  readLiquidCameraPrefs,
  type LiquidCameraMode,
  type LiquidCameraPrefs,
} from "@/lib/pokegrade/camera-mode";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import {
  confirmLiveCatalogCandidate,
  refreshLiveCatalogCandidates,
  rejectLiveCatalogCandidate,
  runLiveCardScan,
} from "@/lib/pokegrade/live-scan";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import { rowHasMarketData } from "@/lib/scan/enrich-specimen-utils";
import { captureLiveScanFrames } from "@/lib/scan/live-camera-frame";
import { dataUrlToJpegFile } from "@/lib/scan/prepare-upload-image";
import { isScanLimitError } from "@/lib/scan/scan-limit-error";
import { cn } from "@/lib/cn";

const AUTO_SCAN_MS_IDLE = 1_800;
const AUTO_SCAN_MS_BUSY = 4_500;

/**
 * In-app camera — adaptive frame, edge snap, quality hints, inline results, auto-add.
 */
export function LiquidScanLiveCamera({
  open,
  onClose,
  laneMode,
  onAddToSession,
  onCapturePhoto,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  laneMode: ScanLaneMode;
  onAddToSession: (result: LiveScanResult, file: File) => void;
  onCapturePhoto?: (file: File) => void;
  busy?: boolean;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLockRef = useRef(false);
  const pipelineBusyRef = useRef(false);
  const lastAutoAddedRef = useRef<string | null>(null);

  const [prefs, setPrefs] = useState<LiquidCameraPrefs>(() => readLiquidCameraPrefs());
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [marketLoading, setMarketLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LiveScanResult | null>(null);
  const lastCaptureRef = useRef<string | null>(null);

  const isLiveMode = prefs.mode === "live-scan";
  const autoScanOn = isLiveMode;

  const { guide: baseGuide, containerSize } = useLiveCameraGuide(
    previewRef,
    laneMode,
    open && !useNativeFallback,
  );

  const { activeGuide, hints } = useLiveCameraAnalysis(
    videoRef,
    containerSize,
    baseGuide,
    laneMode,
    open && !useNativeFallback,
    scanning || marketLoading || Boolean(lastResult),
  );

  const captureGuide = baseGuide;

  const updatePrefs = useCallback((patch: Partial<LiquidCameraPrefs>) => {
    setPrefs(patchLiquidCameraPrefs(patch));
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setLastResult(null);
      lastCaptureRef.current = null;
      lastAutoAddedRef.current = null;
      setCameraError(null);
      setUseNativeFallback(false);
      setPrefs(readLiquidCameraPrefs());
      return;
    }
  }, [open, stopCamera]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function start() {
      setCameraError(null);
      setUseNativeFallback(false);
      if (!navigator.mediaDevices?.getUserMedia) {
        setUseNativeFallback(true);
        setCameraError("Live camera needs HTTPS and a modern browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play();
        }
      } catch (err) {
        setUseNativeFallback(true);
        setCameraError(
          err instanceof Error
            ? err.message
            : "Camera blocked — allow permission or use device camera below.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  const captureFrames = useCallback(async (): Promise<{
    visionUrl: string;
    evidenceUrl: string;
  } | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !captureGuide || containerSize.width <= 0) {
      return null;
    }
    try {
      return await captureLiveScanFrames(video, containerSize, captureGuide);
    } catch {
      return null;
    }
  }, [captureGuide, containerSize]);

  const commitResult = useCallback(
    async (result: LiveScanResult, closeAfter: boolean) => {
      setAdding(true);
      try {
        const file = await dataUrlToJpegFile(result.previewUrl, `live-scan-${Date.now()}.jpg`);
        onAddToSession(result, file);
        if (closeAfter) {
          onClose();
        } else {
          setLastResult(null);
          lastCaptureRef.current = null;
          setStatusText(`Added · ${result.hud.cardName}`);
          window.setTimeout(() => setStatusText(null), 1400);
        }
      } finally {
        setAdding(false);
      }
    },
    [onAddToSession, onClose],
  );

  const runScan = useCallback(async () => {
    if (pipelineBusyRef.current || busy || useNativeFallback || !captureGuide) return;
    pipelineBusyRef.current = true;
    scanLockRef.current = true;
    setScanning(true);
    setMarketLoading(false);
    setStatusText("Frame capture…");
    try {
      const frames = await captureFrames();
      if (!frames) throw new Error("Camera not ready — hold steady and retry.");
      const { visionUrl, evidenceUrl } = frames;
      if (
        evidenceUrl === lastCaptureRef.current &&
        lastResult &&
        rowHasMarketData(lastResult.specimen.context)
      ) {
        return;
      }
      lastCaptureRef.current = evidenceUrl;
      setStatusText("Reading card…");
      const result = await runLiveCardScan({
        visionUrl,
        evidenceUrl,
        laneMode,
        onCatalogReady: (partial) => {
          setLastResult(partial);
          setScanning(false);
          if (rowHasMarketData(partial.specimen.context)) {
            setMarketLoading(false);
            setStatusText(null);
          } else {
            setMarketLoading(true);
            setStatusText("Loading market…");
          }
        },
        onMarketReady: (full) => {
          setLastResult(full);
          setMarketLoading(false);
          setStatusText(null);
        },
      });
      setLastResult(result);
      setMarketLoading(false);
      setStatusText(null);
    } catch (err) {
      if (isScanLimitError(err)) {
        setStatusText("Scan limit reached.");
      } else {
        setStatusText(err instanceof Error ? err.message : "Scan failed");
      }
      setLastResult(null);
      setMarketLoading(false);
    } finally {
      setScanning(false);
      scanLockRef.current = false;
      pipelineBusyRef.current = false;
    }
  }, [busy, captureFrames, captureGuide, laneMode, lastResult, useNativeFallback]);

  useEffect(() => {
    if (!open || !autoScanOn || cameraError || useNativeFallback || !captureGuide) return;
    const intervalMs =
      scanning || marketLoading || busy || lastResult ? AUTO_SCAN_MS_BUSY : AUTO_SCAN_MS_IDLE;
    const id = window.setInterval(() => {
      if (!pipelineBusyRef.current && !scanning && !marketLoading && !busy && !lastResult) {
        void runScan();
      }
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [
    open,
    autoScanOn,
    cameraError,
    useNativeFallback,
    captureGuide,
    scanning,
    marketLoading,
    busy,
    lastResult,
    runScan,
  ]);

  useEffect(() => {
    if (!prefs.autoAddOnLock || !lastResult || scanning || marketLoading || adding) return;
    if (!rowHasMarketData(lastResult.specimen.context)) return;
    if (lastAutoAddedRef.current === lastResult.previewUrl) return;
    lastAutoAddedRef.current = lastResult.previewUrl;
    void commitResult(lastResult, false);
  }, [prefs.autoAddOnLock, lastResult, scanning, marketLoading, adding, commitResult]);

  const handleSnapPhoto = useCallback(async () => {
    if (!onCapturePhoto || useNativeFallback) return;
    const frames = await captureFrames();
    if (!frames) return;
    const file = await dataUrlToJpegFile(frames.evidenceUrl, `snap-${Date.now()}.jpg`);
    onCapturePhoto(file);
    setStatusText("Photo added — tap Start AI Scan in chat");
    window.setTimeout(() => setStatusText(null), 2500);
  }, [captureFrames, onCapturePhoto, useNativeFallback]);

  const handleAdd = useCallback(() => {
    if (!lastResult) return;
    void commitResult(lastResult, true);
  }, [lastResult, commitResult]);

  const handleConfirmCatalogCandidate = useCallback(
    (_specimenId: string, candidate: CatalogCandidate) => {
      if (!lastResult) return;
      setCatalogBusy(true);
      setMarketLoading(true);
      void confirmLiveCatalogCandidate(lastResult, candidate)
        .then((updated) => {
          setLastResult(updated);
          setMarketLoading(false);
        })
        .finally(() => setCatalogBusy(false));
    },
    [lastResult],
  );

  const handleRejectCatalogCandidate = useCallback(
    (_specimenId: string, catalogId: string) => {
      if (!lastResult) return;
      setLastResult(rejectLiveCatalogCandidate(lastResult, catalogId));
    },
    [lastResult],
  );

  const handleRefreshCatalogCandidates = useCallback(
    (_specimenId: string) => {
      if (!lastResult || catalogBusy) return;
      setCatalogBusy(true);
      void refreshLiveCatalogCandidates(lastResult)
        .then(setLastResult)
        .finally(() => setCatalogBusy(false));
    },
    [lastResult, catalogBusy],
  );

  const setCameraMode = useCallback(
    (mode: LiquidCameraMode) => {
      updatePrefs({ mode });
      if (mode === "picture") setLastResult(null);
    },
    [updatePrefs],
  );

  const openNativeCamera = useCallback(() => {
    fallbackInputRef.current?.click();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files?.length && onCapturePhoto) onCapturePhoto(files[0]!);
          e.target.value = "";
          onClose();
        }}
      />

      <div ref={previewRef} className="relative min-h-0 flex-1 overflow-hidden">
        {!useNativeFallback ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-[rgb(5,6,9)] p-6 text-center">
            <Camera className="h-12 w-12 text-slate-500" />
            <p className="max-w-xs text-sm text-slate-300">
              {cameraError ?? "Use device camera — HUD requires in-app camera access."}
            </p>
            <Button type="button" variant="scan" onClick={openNativeCamera}>
              Open device camera
            </Button>
          </div>
        )}

        {!useNativeFallback ? (
          <>
            <PgtHelmetHudOverlay
              hud={lastResult?.hud ?? null}
              scanning={scanning}
              marketLoading={marketLoading}
              statusText={statusText}
              autoScanOn={autoScanOn}
              laneMode={laneMode}
              guide={activeGuide ?? baseGuide}
              hints={hints}
              showCompactReadout={!lastResult || prefs.autoAddOnLock}
            />
            {!prefs.autoAddOnLock && lastResult ? (
              <LiveScanResultSheet
                result={lastResult}
                onAdd={handleAdd}
                adding={adding}
                loadingMarket={marketLoading}
                marketReady={rowHasMarketData(lastResult.specimen.context)}
                catalogBusy={catalogBusy}
                onConfirmCatalogCandidate={handleConfirmCatalogCandidate}
                onRejectCatalogCandidate={handleRejectCatalogCandidate}
                onRefreshCatalogCandidates={handleRefreshCatalogCandidates}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "flex shrink-0 flex-col gap-1.5 border-t border-white/10 bg-[rgb(5,6,9)]/98 px-2 py-2",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10 w-10 shrink-0 rounded-xl p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>

          {!useNativeFallback ? (
            <>
              <div className="flex h-10 shrink-0 items-center rounded-xl bg-white/5 p-0.5">
                <button
                  type="button"
                  onClick={() => setCameraMode("live-scan")}
                  className={cn(
                    "flex h-9 items-center gap-1 rounded-lg px-2 text-[9px] font-semibold uppercase tracking-wide touch-manipulation",
                    isLiveMode ? "bg-cyan-500/20 text-cyan-100" : "text-slate-500",
                  )}
                  aria-pressed={isLiveMode}
                >
                  <Radio className="h-3 w-3" />
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setCameraMode("picture")}
                  className={cn(
                    "flex h-9 items-center gap-1 rounded-lg px-2 text-[9px] font-semibold uppercase tracking-wide touch-manipulation",
                    !isLiveMode ? "bg-violet-500/20 text-violet-100" : "text-slate-500",
                  )}
                  aria-pressed={!isLiveMode}
                >
                  <Aperture className="h-3 w-3" />
                  Photo
                </button>
              </div>

              <button
                type="button"
                onClick={() => updatePrefs({ autoAddOnLock: !prefs.autoAddOnLock })}
                className={cn(
                  "flex h-10 items-center gap-1 rounded-xl px-2 text-[9px] font-medium touch-manipulation",
                  prefs.autoAddOnLock
                    ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                    : "bg-white/5 text-slate-400",
                )}
                aria-pressed={prefs.autoAddOnLock}
                title="Auto-add on match"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                Queue
              </button>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={scanning || marketLoading || busy || !captureGuide}
                onClick={() => void runScan()}
                className="h-10 min-w-0 flex-1 gap-1 rounded-xl px-2 text-xs"
              >
                {isLiveMode ? <Zap className="h-3.5 w-3.5 shrink-0" /> : <Scan className="h-3.5 w-3.5 shrink-0" />}
                {isLiveMode ? "Scan" : "Capture"}
              </Button>

              {onCapturePhoto ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={scanning || busy}
                  onClick={() => void handleSnapPhoto()}
                  className="h-10 w-10 shrink-0 rounded-xl p-0 text-slate-400"
                  title="Save to upload queue"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
              ) : null}

              {!prefs.autoAddOnLock ? (
                <Button
                  type="button"
                  variant="scan"
                  size="sm"
                  disabled={!lastResult || scanning || marketLoading || adding}
                  onClick={handleAdd}
                  className={cn(
                    "h-10 min-w-0 flex-1 gap-1 rounded-xl px-2 text-xs",
                    lastResult && !scanning && "ring-2 ring-emerald-400/40",
                  )}
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  Add
                </Button>
              ) : null}
            </>
          ) : (
            <Button type="button" variant="scan" className="ml-auto h-10 flex-1" onClick={openNativeCamera}>
              Device camera
            </Button>
          )}
        </div>
        {!useNativeFallback ? (
          <p className="truncate px-1 text-center text-[9px] text-slate-600">
            {isLiveMode ? "Live auto-scan" : "Photo — tap Capture per card"}
            {prefs.autoAddOnLock ? " · auto-queue on" : " · review then Add"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
