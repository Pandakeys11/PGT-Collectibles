"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Calculator,
  Camera,
  Ellipsis,
  FileImage,
  Gamepad2,
  Gavel,
  Loader2,
  Scan,
  TrendingUp,
  Tv,
  Upload,
  Zap,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import type { CatalogCandidate } from "@/lib/scan/schemas";
import type { UploadedImage } from "@/lib/scanner-chat/types";
import { CatalogMatchQuickPick } from "./catalog-match-quick-pick";
import { ImagePreviewStrip } from "./image-preview-strip";
import { cn } from "@/lib/cn";

export function ScannerComposer({
  prompt,
  onPromptChange,
  images,
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
  digitalScanOn,
  onDigitalScanOnChange,
  onOpenLiveCamera,
  onOpenCalculator,
  onOpenLiveMarket,
  onOpenEbayEnding,
  onOpenPgtYoutube,
  onOpenPgtArcade,
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
  digitalScanOn: boolean;
  onDigitalScanOnChange: (on: boolean) => void;
  onOpenLiveCamera: () => void;
  onOpenCalculator?: () => void;
  onOpenLiveMarket?: () => void;
  onOpenEbayEnding?: () => void;
  onOpenPgtYoutube?: () => void;
  onOpenPgtArcade?: () => void;
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
  const [moreOpen, setMoreOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nativeCameraRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (moreRef.current?.contains(e.target as Node)) return;
      setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [moreOpen]);

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
      : "Ask PGT…";

  return (
    <div
      className={cn(
        "sc-mobile-composer shrink-0 border-t border-white/6 bg-chrome-deep backdrop-blur-xl",
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
            className="sc-composer-input max-h-[4.5rem] min-h-[2.125rem] w-full resize-none bg-transparent px-2 py-1 text-base leading-snug text-slate-100 placeholder:text-slate-500 focus:outline-none sm:min-h-[2.5rem] sm:max-h-[5.5rem] sm:text-sm"
            disabled={isBusy}
            aria-label="Message or scan instructions"
          />

          <div className="sc-composer-actions mt-1 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-1.5">
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

            <div className="sc-composer-tools-row flex min-w-0 items-center gap-0.5 sm:gap-1 lg:min-w-0 lg:flex-1 lg:gap-1.5">
              {onOpenLiveMarket ? (
                <button
                  type="button"
                  onClick={onOpenLiveMarket}
                  disabled={isBusy}
                  className="sc-composer-icon-btn hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-sky-200 disabled:opacity-40 touch-manipulation lg:flex lg:h-9 lg:w-9"
                  aria-label="Open live market pulse"
                  title="Live market — trending sets"
                >
                  <TrendingUp className="h-4 w-4" />
                </button>
              ) : null}
              {onOpenEbayEnding ? (
                <button
                  type="button"
                  onClick={onOpenEbayEnding}
                  disabled={isBusy}
                  className="sc-composer-icon-btn hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-rose-200 disabled:opacity-40 touch-manipulation lg:flex lg:h-9 lg:w-9"
                  aria-label="Open eBay ending soon auctions"
                  title="eBay — Pokémon auctions ending soon"
                >
                  <Gavel className="h-4 w-4" />
                </button>
              ) : null}
              {onOpenPgtYoutube ? (
                <button
                  type="button"
                  onClick={onOpenPgtYoutube}
                  disabled={isBusy}
                  className="sc-composer-icon-btn hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-violet-200 disabled:opacity-40 touch-manipulation lg:flex lg:h-9 lg:w-9"
                  aria-label="Open PGT Video"
                  title="PGT Video — Pokémon episodes & playlist"
                >
                  <Tv className="h-4 w-4" />
                </button>
              ) : null}
              {onOpenPgtArcade ? (
                <button
                  type="button"
                  onClick={onOpenPgtArcade}
                  disabled={isBusy}
                  className="sc-composer-icon-btn hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-indigo-200 disabled:opacity-40 touch-manipulation lg:flex lg:h-9 lg:w-9"
                  aria-label="Open PGT Arcade"
                  title="PGT Arcade — emulator games on PGTools (wallet sign-in)"
                >
                  <Gamepad2 className="h-4 w-4" />
                </button>
              ) : null}
              {onOpenCalculator ? (
                <button
                  type="button"
                  onClick={onOpenCalculator}
                  disabled={isBusy}
                  className="sc-composer-icon-btn hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-emerald-200 disabled:opacity-40 touch-manipulation lg:flex lg:h-9 lg:w-9"
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
                className="sc-composer-icon-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-40 touch-manipulation sm:h-10 sm:w-10 lg:h-9 lg:w-9"
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
                  "sc-composer-icon-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition touch-manipulation sm:h-10 sm:w-10 lg:h-9 lg:w-9",
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
                  digitalScanOn
                    ? "Digital Scan on — one scanner-grade file per card"
                    : "Digital Scan off — identity and market only"
                }
                onClick={() => onDigitalScanOnChange(!digitalScanOn)}
                disabled={isBusy}
                aria-pressed={digitalScanOn}
                className={cn(
                  "sc-composer-icon-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition touch-manipulation sm:h-10 sm:w-10 lg:h-9 lg:w-9",
                  digitalScanOn
                    ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/30"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
                )}
                aria-label={digitalScanOn ? "Digital Scan on" : "Digital Scan off"}
              >
                <FileImage className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={
                  speedOn
                    ? "Speed on — higher parallel vision/catalog/market"
                    : "Speed off — gentler pacing; extra verify on weak single-card reads"
                }
                onClick={() => onSpeedOnChange(!speedOn)}
                disabled={isBusy}
                aria-pressed={speedOn}
                className={cn(
                  "sc-composer-icon-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition touch-manipulation sm:h-10 sm:w-10 lg:h-9 lg:w-9",
                  speedOn
                    ? "bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30"
                    : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
                )}
                aria-label={speedOn ? "Speed on" : "Speed off"}
              >
                <Zap className="h-4 w-4" />
              </button>

              {(onOpenLiveMarket || onOpenEbayEnding || onOpenPgtYoutube || onOpenPgtArcade || onOpenCalculator) ? (
                <div ref={moreRef} className="relative shrink-0 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    disabled={isBusy}
                    aria-expanded={moreOpen}
                    aria-haspopup="menu"
                    className={cn(
                      "sc-composer-icon-btn flex h-9 w-9 items-center justify-center rounded-lg transition touch-manipulation sm:h-10 sm:w-10",
                      moreOpen
                        ? "bg-white/10 text-slate-200"
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-300",
                    )}
                    aria-label="More tools"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </button>
                  {moreOpen ? (
                    <div
                      role="menu"
                      className="sc-composer-more-menu absolute bottom-full right-0 z-50 mb-1.5 min-w-[10.5rem] overflow-hidden rounded-xl border border-white/10 bg-chrome-deep py-1 shadow-xl"
                    >
                      <div className="flex items-center justify-between border-b border-white/8 px-2.5 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          Tools
                        </span>
                        <button
                          type="button"
                          onClick={() => setMoreOpen(false)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 hover:bg-white/5"
                          aria-label="Close menu"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {onOpenLiveMarket ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onOpenLiveMarket();
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-white/5"
                        >
                          <TrendingUp className="h-4 w-4 shrink-0 text-sky-300" />
                          Live market
                        </button>
                      ) : null}
                      {onOpenEbayEnding ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onOpenEbayEnding();
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-white/5"
                        >
                          <Gavel className="h-4 w-4 shrink-0 text-rose-300" />
                          eBay ending
                        </button>
                      ) : null}
                      {onOpenPgtYoutube ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onOpenPgtYoutube();
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-white/5"
                        >
                          <Tv className="h-4 w-4 shrink-0 text-violet-300" />
                          PGT Video
                        </button>
                      ) : null}
                      {onOpenPgtArcade ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onOpenPgtArcade();
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-white/5"
                        >
                          <Gamepad2 className="h-4 w-4 shrink-0 text-indigo-300" />
                          PGT Arcade
                        </button>
                      ) : null}
                      {onOpenCalculator ? (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onOpenCalculator();
                            setMoreOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs text-slate-200 hover:bg-white/5"
                        >
                          <Calculator className="h-4 w-4 shrink-0 text-emerald-300" />
                          Calculator
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="scan"
              size="sm"
              disabled={isBusy}
              onClick={onSubmit}
              className="sc-composer-submit h-10 w-full shrink-0 gap-1.5 rounded-lg px-4 touch-manipulation lg:ml-auto lg:h-9 lg:w-auto lg:min-w-[4.75rem]"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasImages ? (
                <Scan className="h-4 w-4" />
              ) : null}
              <span className="text-sm font-semibold lg:text-xs">{submitLabel}</span>
            </Button>
          </div>
        </div>

        {!hasImages && !hasScanResults ? (
          <p className="sc-composer-hint mt-1 hidden text-center text-[10px] text-slate-600 sm:block lg:mt-0.5">
            Upload or camera — binder pages, slabs, and singles auto-detect · Enter to send
          </p>
        ) : null}
        <p
          className="sc-composer-hint-sr sr-only"
          aria-live="polite"
        >
          Liquid Scan auto-detects binder pages, slabs, and single cards.
          {digitalScanOn ? " Digital Scan on." : ""}
          {speedOn ? " Speed on." : " Speed off."}
        </p>
      </div>
    </div>
  );
}
