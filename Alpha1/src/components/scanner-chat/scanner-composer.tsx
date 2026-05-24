"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Scan, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCAN_MODE_OPTIONS } from "@/lib/scanner-chat/scan-mode-labels";
import type { ScanMode, UploadedImage } from "@/lib/scanner-chat/types";
import { ImagePreviewStrip } from "./image-preview-strip";
import { cn } from "@/lib/cn";

export function ScannerComposer({
  prompt,
  onPromptChange,
  images,
  scanMode,
  onScanModeChange,
  onFiles,
  onRemoveImage,
  onReorderImages,
  onSubmit,
  isBusy,
  uploadsLocked,
  hasImages,
  hasScanResults,
  speedOn,
  onSpeedOnChange,
  onOpenLiveCamera,
  supportsLiveCamera,
  className,
}: {
  prompt: string;
  onPromptChange: (v: string) => void;
  images: UploadedImage[];
  scanMode: ScanMode;
  onScanModeChange: (mode: ScanMode) => void;
  onFiles: (files: FileList | File[]) => void;
  onRemoveImage: (id: string) => void;
  onReorderImages: (from: number, to: number) => void;
  onSubmit: () => void;
  isBusy: boolean;
  uploadsLocked?: boolean;
  hasImages: boolean;
  hasScanResults: boolean;
  speedOn: boolean;
  onSpeedOnChange: (on: boolean) => void;
  onOpenLiveCamera: () => void;
  supportsLiveCamera?: boolean;
  className?: string;
}) {
  const [liveCameraOk, setLiveCameraOk] = useState(supportsLiveCamera ?? false);
  useEffect(() => {
    setLiveCameraOk(
      supportsLiveCamera ??
        (typeof navigator !== "undefined" &&
          Boolean(navigator.mediaDevices?.getUserMedia)),
    );
  }, [supportsLiveCamera]);
  const submitLabel = hasImages
    ? isBusy
      ? "Scanning…"
      : "Start AI Scan"
    : isBusy
      ? "Thinking…"
      : hasScanResults
        ? "Ask"
        : "Send";
  const fileRef = useRef<HTMLInputElement>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "sc-mobile-composer shrink-0 border-t border-white/6 bg-[rgb(8,10,14)]/95 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto max-w-3xl px-3 pt-2 sm:px-4 sm:pt-3">
        <ImagePreviewStrip
          images={images}
          onRemove={onRemoveImage}
          onReorder={onReorderImages}
          scanning={isBusy}
          className="mb-2"
        />
        <div className="sc-glow-border rounded-2xl sc-glass-raised p-2 sm:p-3">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={2}
            placeholder={
              hasImages
                ? "Optional: what should we look for?"
                : hasScanResults
                  ? "Ask about FMV, comps, or your scan…"
                  : "Ask PGT AI or upload images to scan…"
            }
            className="sc-composer-input w-full resize-none bg-transparent px-2 py-1.5 text-base text-slate-100 placeholder:text-slate-600 focus:outline-none sm:text-sm"
            disabled={isBusy}
          />

          {/* Primary actions — touch-friendly row */}
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={uploadsLocked}
              onChange={(e) => {
                if (uploadsLocked || !e.target.files?.length) return;
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={nativeCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploadsLocked}
              onChange={(e) => {
                if (uploadsLocked || !e.target.files?.length) return;
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isBusy || uploadsLocked}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 touch-manipulation"
              aria-label="Upload images"
            >
              <Upload className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (liveCameraOk) onOpenLiveCamera();
                else nativeCameraRef.current?.click();
              }}
              disabled={isBusy || uploadsLocked}
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition touch-manipulation disabled:opacity-40",
                liveCameraOk
                  ? "text-emerald-300 ring-1 ring-emerald-500/35 hover:bg-emerald-500/10"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
              )}
              aria-label={liveCameraOk ? "Open PGT scan camera with HUD" : "Capture photo"}
              title={
                liveCameraOk
                  ? "PGT helmet HUD · live auto-scan"
                  : "Device camera (HUD needs HTTPS)"
              }
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={
                speedOn
                  ? "Speed on: faster scan"
                  : "Speed off: cost control"
              }
              onClick={() => onSpeedOnChange(!speedOn)}
              disabled={isBusy}
              aria-pressed={speedOn}
              className={cn(
                "h-11 shrink-0 rounded-full px-3 text-[11px] font-medium transition touch-manipulation",
                speedOn
                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
              )}
            >
              Speed {speedOn ? "On" : "Off"}
            </button>
            <Button
              type="button"
              variant="scan"
              size="sm"
              disabled={isBusy}
              onClick={onSubmit}
              className="ml-auto h-11 min-w-[5.5rem] shrink-0 gap-1.5 rounded-xl px-4 touch-manipulation"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasImages ? (
                <Scan className="h-4 w-4" />
              ) : null}
              <span className="text-xs font-semibold sm:text-sm">{submitLabel}</span>
            </Button>
          </div>

          {/* Scan modes — own scroll row so they don't crush submit on narrow phones */}
          <div className="sc-composer-modes mt-2 flex gap-1 overflow-x-auto pb-0.5 scanner-chat-scrollbar">
            {SCAN_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.description}
                onClick={() => onScanModeChange(opt.id)}
                disabled={isBusy}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition touch-manipulation",
                  scanMode === opt.id
                    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <p className="sc-composer-hint mt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-[10px] text-slate-600 sm:pb-2">
          {hasImages
            ? speedOn
              ? "Speed on · parallel scan"
              : "Speed off · fewer API calls"
            : hasScanResults
              ? "Tap a card or open Sheet for your list"
              : "Camera opens PGT HUD · auto-scan · 1 credit per scan"}
        </p>
      </div>
    </div>
  );
}
