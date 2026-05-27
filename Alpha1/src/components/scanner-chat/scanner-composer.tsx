"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator, Camera, ChevronDown, Loader2, Scan, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SCAN_MODE_OPTIONS } from "@/lib/scanner-chat/scan-mode-labels";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import type { ScanMode, UploadedImage } from "@/lib/scanner-chat/types";
import { CatalogMatchQuickPick } from "./catalog-match-quick-pick";
import { ImagePreviewStrip } from "./image-preview-strip";
import { cn } from "@/lib/cn";

const MODE_SHORT: Record<ScanMode, string> = {
  fast: "Fast",
  deep: "Deep",
  market: "Market",
  graded: "Graded",
  binder: "Binder",
};

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
  onOpenCalculator,
  supportsLiveCamera,
  reviewSpecimen,
  onConfirmCatalogCandidate,
  onRejectCatalogCandidate,
  onRefreshCatalogCandidates,
  onOpenMasterCatalog,
  catalogRefreshingId,
  catalogBusy,
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
  onOpenCalculator?: () => void;
  supportsLiveCamera?: boolean;
  reviewSpecimen?: ScanSpecimen | null;
  onConfirmCatalogCandidate?: (specimenId: string, candidate: CatalogCandidate) => void;
  onRejectCatalogCandidate?: (specimenId: string, catalogId: string) => void;
  onRefreshCatalogCandidates?: (specimenId: string) => void;
  onOpenMasterCatalog?: () => void;
  catalogRefreshingId?: string | null;
  catalogBusy?: boolean;
  className?: string;
}) {
  const [liveCameraOk, setLiveCameraOk] = useState(supportsLiveCamera ?? false);
  const [modesOpen, setModesOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLiveCameraOk(
      supportsLiveCamera ??
        (typeof navigator !== "undefined" &&
          Boolean(navigator.mediaDevices?.getUserMedia)),
    );
  }, [supportsLiveCamera]);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 88)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [prompt, resizeTextarea]);

  const submitLabel = hasImages
    ? isBusy
      ? "Scanning…"
      : "Scan"
    : isBusy
      ? "…"
      : hasScanResults
        ? "Ask"
        : "Send";

  const placeholder = hasImages
    ? "Optional note for scan…"
    : hasScanResults
      ? "Ask about FMV or comps…"
      : "Ask PGT AI or add images…";

  const activeMode = SCAN_MODE_OPTIONS.find((o) => o.id === scanMode);

  return (
    <div
      className={cn(
        "sc-mobile-composer shrink-0 border-t border-white/6 bg-[rgb(8,10,14)]/95 backdrop-blur-xl",
        className,
      )}
    >
      <div className="sc-mobile-composer-inner sc-desktop-composer-inner mx-auto w-full max-w-3xl px-0 pt-1.5 sm:pt-2 lg:max-w-none">
        {hasScanResults &&
        reviewSpecimen &&
        onConfirmCatalogCandidate &&
        onRejectCatalogCandidate ? (
          <CatalogMatchQuickPick
            className="mb-2"
            specimen={reviewSpecimen}
            busy={catalogBusy}
            refreshing={catalogRefreshingId === reviewSpecimen.id}
            onConfirm={onConfirmCatalogCandidate}
            onReject={onRejectCatalogCandidate}
            onRefreshCandidates={onRefreshCatalogCandidates}
            onOpenMasterCatalog={onOpenMasterCatalog}
          />
        ) : null}
        {images.length > 0 ? (
          <ImagePreviewStrip
            images={images}
            onRemove={onRemoveImage}
            onReorder={onReorderImages}
            scanning={isBusy}
            compact
            className="mb-1.5"
          />
        ) : null}

        <div className="sc-composer-panel sc-glow-border rounded-xl sc-glass-raised p-1.5 sm:rounded-2xl sm:p-2">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onInput={resizeTextarea}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="sc-composer-input max-h-[5.5rem] min-h-[2.35rem] w-full resize-none bg-transparent px-2 py-1 text-base leading-snug text-slate-100 placeholder:text-slate-600 focus:outline-none sm:min-h-[2.5rem] sm:text-sm"
            disabled={isBusy}
            aria-label="Message or scan instructions"
          />

          <div className="mt-1 flex items-center gap-1 sm:gap-1.5">
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

            {onOpenCalculator ? (
              <button
                type="button"
                onClick={onOpenCalculator}
                disabled={isBusy}
                className="sc-composer-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-emerald-200 disabled:opacity-40 touch-manipulation lg:h-9 lg:w-9"
                aria-label="Open deal calculator"
                title="Collector / vendor calculator"
              >
                <Calculator className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={isBusy || uploadsLocked}
              className="sc-composer-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 touch-manipulation lg:h-9 lg:w-9"
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
                "sc-composer-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition touch-manipulation lg:h-9 lg:w-9",
                liveCameraOk
                  ? "text-emerald-300 ring-1 ring-emerald-500/35 hover:bg-emerald-500/10"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-200",
              )}
              aria-label={liveCameraOk ? "Open PGT scan camera" : "Capture photo"}
              title={liveCameraOk ? "PGT helmet HUD" : "Device camera"}
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={
                speedOn
                  ? "Speed on — balanced parallel scan + registry on slabs"
                  : "Speed off — slower pacing, deeper precision crops, registry on slabs only"
              }
              onClick={() => onSpeedOnChange(!speedOn)}
              disabled={isBusy}
              aria-pressed={speedOn}
              className={cn(
                "sc-composer-icon-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition touch-manipulation lg:h-9 lg:w-9",
                speedOn
                  ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
              )}
              aria-label={speedOn ? "Speed on" : "Speed off"}
            >
              <Zap className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setModesOpen((v) => !v)}
              disabled={isBusy}
              aria-expanded={modesOpen}
              aria-controls="sc-composer-modes"
              className={cn(
                "flex h-10 min-w-0 shrink items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition touch-manipulation lg:h-9",
                modesOpen
                  ? "bg-white/8 text-slate-200"
                  : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
              )}
            >
              <span className="truncate">{MODE_SHORT[scanMode]}</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 shrink-0 transition", modesOpen && "rotate-180")}
                aria-hidden
              />
            </button>

            <Button
              type="button"
              variant="scan"
              size="sm"
              disabled={isBusy}
              onClick={onSubmit}
              className="sc-composer-submit ml-auto h-10 min-w-[4.25rem] shrink-0 gap-1 rounded-lg px-3 touch-manipulation sm:min-w-[4.75rem] lg:h-9"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasImages ? (
                <Scan className="h-4 w-4" />
              ) : null}
              <span className="text-xs font-semibold">{submitLabel}</span>
            </Button>
          </div>

          <div
            id="sc-composer-modes"
            className={cn(
              "sc-composer-modes grid transition-[grid-template-rows] duration-200 ease-out",
              modesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex gap-1 overflow-x-auto pb-0.5 pt-1.5 scanner-chat-scrollbar">
                {SCAN_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.description}
                    onClick={() => {
                      onScanModeChange(opt.id);
                      setModesOpen(false);
                    }}
                    disabled={isBusy}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition touch-manipulation sm:px-3 sm:py-1.5 sm:text-[11px]",
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
          </div>
        </div>

        {!hasImages && !hasScanResults ? (
          <p className="sc-composer-hint mt-1 hidden text-center text-[10px] text-slate-600 sm:block lg:mt-0.5">
            Upload or camera · tap mode for binder / graded · Enter to send
          </p>
        ) : null}
        <p
          className="sc-composer-hint-sr sr-only"
          aria-live="polite"
        >
          {activeMode?.description}
          {speedOn ? " Speed on." : " Speed off."}
        </p>
      </div>
    </div>
  );
}
