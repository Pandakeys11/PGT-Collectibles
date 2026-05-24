"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Scan, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PokeGradeHudOverlay } from "@/components/scanner-chat/pokegrade-hud-overlay";
import type { ScanLaneMode } from "@/hooks/use-scan-session";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import { runLiveCardScan } from "@/lib/pokegrade/live-scan";
import {
  captureVideoFrameToDataUrl,
  dataUrlToJpegFile,
} from "@/lib/scan/prepare-upload-image";
import { isScanLimitError } from "@/lib/scan/scan-limit-error";
import { cn } from "@/lib/cn";

const AUTO_SCAN_MS = 3_200;

export function LiquidScanLiveCamera({
  open,
  onClose,
  laneMode,
  autoScan,
  onAddToSession,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  laneMode: ScanLaneMode;
  autoScan: boolean;
  onAddToSession: (result: LiveScanResult, file: File) => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLockRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LiveScanResult | null>(null);
  const lastCaptureRef = useRef<string | null>(null);

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
      setCameraError(null);
      return;
    }

    let cancelled = false;

    async function start() {
      setCameraError(null);
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
          await video.play();
        }
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? err.message
            : "Camera access denied — allow camera permission or use Upload instead.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera]);

  const runScan = useCallback(async () => {
    const video = videoRef.current;
    if (!video || scanLockRef.current || busy) return;
    scanLockRef.current = true;
    setScanning(true);
    setStatusText("Capturing frame…");
    try {
      const dataUrl = await captureVideoFrameToDataUrl(video);
      if (dataUrl === lastCaptureRef.current && lastResult) {
        setScanning(false);
        scanLockRef.current = false;
        return;
      }
      lastCaptureRef.current = dataUrl;
      setStatusText("Vision + market enrich…");
      const result = await runLiveCardScan({
        previewUrl: dataUrl,
        laneMode,
        singleCard: true,
      });
      setLastResult(result);
      setStatusText(null);
    } catch (err) {
      if (isScanLimitError(err)) {
        setStatusText("Scan limit reached — upgrade or wait for reset.");
      } else {
        setStatusText(err instanceof Error ? err.message : "Scan failed");
      }
      setLastResult(null);
    } finally {
      setScanning(false);
      scanLockRef.current = false;
    }
  }, [busy, laneMode, lastResult]);

  useEffect(() => {
    if (!open || !autoScan || cameraError) return;
    const id = window.setInterval(() => {
      if (!scanning && !busy) void runScan();
    }, AUTO_SCAN_MS);
    return () => window.clearInterval(id);
  }, [open, autoScan, cameraError, scanning, busy, runScan]);

  const handleAdd = useCallback(async () => {
    if (!lastResult) return;
    const file = await dataUrlToJpegFile(
      lastResult.previewUrl,
      `live-scan-${Date.now()}.jpg`,
    );
    onAddToSession(lastResult, file);
    onClose();
  }, [lastResult, onAddToSession, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        <div className="pg-hud-vignette pointer-events-none absolute inset-0" />
        <PokeGradeHudOverlay
          hud={lastResult?.hud ?? null}
          scanning={scanning}
          statusText={statusText}
        />
        {cameraError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <p className="text-sm text-rose-200">{cameraError}</p>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-t border-white/10 bg-[rgb(5,6,9)]/95 px-3 py-3",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-11 shrink-0 rounded-xl p-0"
          onClick={onClose}
          aria-label="Close camera"
        >
          <X className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={scanning || busy || Boolean(cameraError)}
          onClick={() => void runScan()}
          className="h-11 flex-1 gap-2 rounded-xl border-cyan-500/30 text-cyan-100"
        >
          <Scan className="h-4 w-4" />
          Scan now
        </Button>
        <Button
          type="button"
          variant="scan"
          size="sm"
          disabled={!lastResult || scanning}
          onClick={() => void handleAdd()}
          className="h-11 flex-1 gap-2 rounded-xl"
        >
          <Plus className="h-4 w-4" />
          Add to sheet
        </Button>
      </div>
    </div>
  );
}
