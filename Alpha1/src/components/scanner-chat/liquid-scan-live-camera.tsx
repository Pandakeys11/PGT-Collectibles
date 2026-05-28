"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Scan, Plus, Camera, Zap, ZapOff, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PgtHelmetHudOverlay } from "@/components/scanner-chat/pgt-helmet-hud-overlay";
import type { ScanLaneMode } from "@/hooks/use-scan-session";
import type { LiveScanResult } from "@/lib/pokegrade/types";
import { runLiveCardScan } from "@/lib/pokegrade/live-scan";
import {
  captureVideoFrameToDataUrl,
  dataUrlToJpegFile,
} from "@/lib/scan/prepare-upload-image";
import { isScanLimitError } from "@/lib/scan/scan-limit-error";
import { cn } from "@/lib/cn";

const AUTO_SCAN_MS_IDLE = 3_000;
const AUTO_SCAN_MS_BUSY = 6_500;

/**
 * In-app camera using getUserMedia — NOT the native `<input capture>` picker.
 * Overlays the PGT helmet HUD on the live preview for manual + auto scanning.
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
  /** Save frame to upload queue without running vision (quick snap). */
  onCapturePhoto?: (file: File) => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLockRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [useNativeFallback, setUseNativeFallback] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoScanOn, setAutoScanOn] = useState(true);
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
      setUseNativeFallback(false);
      setAutoScanOn(true);
      return;
    }

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

  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;
    try {
      return await captureVideoFrameToDataUrl(video);
    } catch {
      return null;
    }
  }, []);

  const runScan = useCallback(async () => {
    if (scanLockRef.current || busy || useNativeFallback) return;
    scanLockRef.current = true;
    setScanning(true);
    setStatusText("Frame capture…");
    try {
      const dataUrl = await captureFrame();
      if (!dataUrl) throw new Error("Camera not ready — hold steady and retry.");
      if (dataUrl === lastCaptureRef.current && lastResult) {
        return;
      }
      lastCaptureRef.current = dataUrl;
      setStatusText("PGT vision…");
      const result = await runLiveCardScan({
        previewUrl: dataUrl,
        laneMode,
        singleCard: true,
        onCatalogReady: (partial) => {
          setLastResult({
            ...partial,
            specimen: partial.specimen,
          });
          setStatusText("Loading market…");
        },
      });
      setLastResult(result);
      setStatusText(null);
    } catch (err) {
      if (isScanLimitError(err)) {
        setStatusText("Scan limit reached.");
      } else {
        setStatusText(err instanceof Error ? err.message : "Scan failed");
      }
      setLastResult(null);
    } finally {
      setScanning(false);
      scanLockRef.current = false;
    }
  }, [busy, captureFrame, laneMode, lastResult, useNativeFallback]);

  useEffect(() => {
    if (!open || !autoScanOn || cameraError || useNativeFallback) return;
    const intervalMs = scanning || busy ? AUTO_SCAN_MS_BUSY : AUTO_SCAN_MS_IDLE;
    const id = window.setInterval(() => {
      if (!scanning && !busy) void runScan();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [open, autoScanOn, cameraError, useNativeFallback, scanning, busy, runScan]);

  const handleSnapPhoto = useCallback(async () => {
    if (!onCapturePhoto || useNativeFallback) return;
    const dataUrl = await captureFrame();
    if (!dataUrl) return;
    const file = await dataUrlToJpegFile(dataUrl, `snap-${Date.now()}.jpg`);
    onCapturePhoto(file);
    setStatusText("Photo added — tap Start AI Scan in chat");
    window.setTimeout(() => setStatusText(null), 2500);
  }, [captureFrame, onCapturePhoto, useNativeFallback]);

  const handleAdd = useCallback(async () => {
    if (!lastResult) return;
    const file = await dataUrlToJpegFile(
      lastResult.previewUrl,
      `live-scan-${Date.now()}.jpg`,
    );
    onAddToSession(lastResult, file);
    onClose();
  }, [lastResult, onAddToSession, onClose]);

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
          if (files?.length && onCapturePhoto) {
            onCapturePhoto(files[0]!);
          }
          e.target.value = "";
          onClose();
        }}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {!useNativeFallback ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
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
          <PgtHelmetHudOverlay
            hud={lastResult?.hud ?? null}
            scanning={scanning}
            statusText={statusText}
            autoScanOn={autoScanOn}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-2 border-t border-white/10 bg-[rgb(5,6,9)]/98 px-2 py-2",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-11 w-11 shrink-0 rounded-xl p-0"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </Button>

        {!useNativeFallback ? (
          <>
            <button
              type="button"
              onClick={() => setAutoScanOn((v) => !v)}
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-xl px-3 text-[10px] font-medium touch-manipulation",
                autoScanOn
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                  : "bg-white/5 text-slate-400",
              )}
              aria-pressed={autoScanOn}
            >
              {autoScanOn ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
              Auto
            </button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={scanning || busy}
              onClick={() => void runScan()}
              className="h-11 min-w-[5rem] flex-1 gap-1.5 rounded-xl text-xs"
            >
              <Scan className="h-4 w-4" />
              Scan
            </Button>
            {onCapturePhoto ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={scanning || busy}
                onClick={() => void handleSnapPhoto()}
                className="h-11 gap-1 rounded-xl px-2 text-[10px] text-slate-400"
                title="Save photo to queue without scanning"
              >
                <ImagePlus className="h-4 w-4" />
                Snap
              </Button>
            ) : null}
            <Button
              type="button"
              variant="scan"
              size="sm"
              disabled={!lastResult || scanning}
              onClick={() => void handleAdd()}
              className="h-11 min-w-[5rem] flex-1 gap-1.5 rounded-xl text-xs"
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </>
        ) : (
          <Button type="button" variant="scan" className="ml-auto h-11 flex-1" onClick={openNativeCamera}>
            Device camera
          </Button>
        )}
      </div>
    </div>
  );
}
