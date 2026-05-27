"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Droplets,
  LineChart,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TourAskPreview,
  TourCatalogPreview,
  TourDetectPreview,
  TourMarketPreview,
  TourUploadPreview,
} from "@/components/scanner-chat/liquid-scan-onboarding-previews";
import { cn } from "@/lib/cn";

/** Bump when tour content changes so returning users see the new walkthrough. */
export const LIQUID_SCAN_ONBOARDING_STORAGE_KEY = "pgt-liquid-scan-onboarding-v2";

export type LiquidScanOnboardingStep = {
  id: string;
  title: string;
  subtitle: string;
  /** One-line value prop (auth rail + dialog). */
  hook: string;
  body: string;
  icon: typeof Camera;
  accent: "cyan" | "emerald" | "amber";
  preview: React.ReactNode;
};

export const LIQUID_SCAN_ONBOARDING_STEPS: LiquidScanOnboardingStep[] = [
  {
    id: "upload",
    title: "Snap or upload",
    subtitle: "Step 1 · Capture",
    hook: "Binder pages, slabs, or singles in one chat session.",
    body: "Use the same composer you get after sign-in — camera, gallery, or drag-and-drop. Multiple photos per scan.",
    icon: Camera,
    accent: "cyan",
    preview: <TourUploadPreview />,
  },
  {
    id: "detect",
    title: "Every card identified",
    subtitle: "Step 2 · Extract",
    hook: "Name, set, grade, cert, and FMV per card — streamed in the feed.",
    body: "Vision isolates each card, assigns confidence, and starts market enrich automatically. Tap a row for full intelligence.",
    icon: Sparkles,
    accent: "emerald",
    preview: <TourDetectPreview />,
  },
  {
    id: "catalog",
    title: "One identity for pricing",
    subtitle: "Step 3 · Identity",
    hook: "Master catalog match and PSA registry when a cert is visible.",
    body: "No re-typing set numbers. Graded slabs pull registry population and verification into Scan Intelligence.",
    icon: Droplets,
    accent: "cyan",
    preview: <TourCatalogPreview />,
  },
  {
    id: "market",
    title: "FMV and sold comps",
    subtitle: "Step 4 · Market",
    hook: "Grade-aware FMV, recent solds, and hub links in one rail.",
    body: "See PSA 10 / 9 / raw tiers, eBay sold rows, and one-tap searches on Card Ladder, ALT, and eBay — matched to the scanned card.",
    icon: LineChart,
    accent: "emerald",
    preview: <TourMarketPreview />,
  },
  {
    id: "ask",
    title: "Ask, then export",
    subtitle: "Step 5 · Research",
    hook: "Questions on comps, pop, or pricing — export CSV when done.",
    body: "Liquid Ask uses your session data and live research. Same workspace before and after sign-in.",
    icon: MessageSquare,
    accent: "cyan",
    preview: <TourAskPreview />,
  },
];

const accentRing: Record<LiquidScanOnboardingStep["accent"], string> = {
  cyan: "text-cyan-400 ring-cyan-400/30 bg-cyan-400/10",
  emerald: "text-emerald-400 ring-emerald-400/30 bg-emerald-400/10",
  amber: "text-amber-400 ring-amber-400/30 bg-amber-400/10",
};

export function LiquidScanOnboardingDemo({
  autoOpen = false,
  open: controlledOpen,
  onOpenChange,
}: {
  autoOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState(0);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (!autoOpen || isControlled) return;
    try {
      if (localStorage.getItem(LIQUID_SCAN_ONBOARDING_STORAGE_KEY) === "1") return;
    } catch {
      /* private mode */
    }
    const timer = window.setTimeout(() => setInternalOpen(true), 500);
    return () => window.clearTimeout(timer);
  }, [autoOpen, isControlled]);

  const current = LIQUID_SCAN_ONBOARDING_STEPS[step];
  const Icon = current.icon;
  const isLast = step >= LIQUID_SCAN_ONBOARDING_STEPS.length - 1;

  const markSeen = () => {
    try {
      localStorage.setItem(LIQUID_SCAN_ONBOARDING_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const close = () => {
    markSeen();
    setOpen(false);
    setStep(0);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          markSeen();
          setStep(0);
        }
        setOpen(next);
      }}
    >
      <DialogContent
        className={cn(
          "scanner-chat-root flex flex-col overflow-hidden border-white/8 bg-[rgb(var(--sc-panel))] p-0",
          "shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]",
          "h-[min(92dvh,40rem)] w-[min(96vw,26rem)]",
          "sm:h-[min(90dvh,42rem)] sm:w-[min(94vw,32rem)]",
          "md:h-[min(88dvh,34rem)] md:w-[min(92vw,48rem)]",
          "lg:h-[min(86dvh,36rem)] lg:w-[min(88vw,56rem)]",
          "max-h-none",
        )}
      >
        <div className="sc-glow-border flex min-h-0 flex-1 flex-col rounded-2xl">
          <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:grid-rows-[auto_minmax(0,1fr)]">
            <header className="shrink-0 border-b border-white/6 px-5 pb-3 pt-5 md:col-span-2 md:px-6 md:pt-6">
              <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-cyan-400" aria-hidden />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/90">
                  PGT Liquid Scan
                </p>
              </div>
              <DialogTitle className="mt-2 font-display text-xl font-semibold leading-tight text-slate-50 md:text-2xl">
                {current.title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-slate-400 md:text-sm">
                {current.subtitle}
              </DialogDescription>
            </header>

            <div className="flex min-h-0 flex-col overflow-y-auto px-5 py-3 scanner-chat-scrollbar md:px-6 md:py-4">
              <div
                className={cn(
                  "mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 md:h-10 md:w-10",
                  accentRing[current.accent],
                )}
              >
                <Icon className="h-4 w-4 md:h-[1.125rem] md:w-[1.125rem]" aria-hidden />
              </div>
              <p className="text-[13px] leading-snug text-slate-300 md:text-sm md:leading-relaxed">
                {current.hook}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500 md:text-xs">
                {current.body}
              </p>
              <div className="sc-glass-raised mt-4 rounded-xl p-2.5 md:hidden">
                {current.preview}
              </div>
            </div>

            <div className="hidden min-h-0 flex-col border-t border-white/6 md:flex md:border-t-0 md:border-l md:px-4 md:py-4">
              <p className="mb-2 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Live preview
              </p>
              <div className="sc-glass-raised min-h-0 flex-1 overflow-y-auto rounded-xl p-3 scanner-chat-scrollbar">
                {current.preview}
              </div>
            </div>
          </div>

          <footer className="shrink-0 border-t border-white/6 px-5 py-3 md:px-6 md:py-4">
            <div className="mb-3 flex items-center justify-center gap-1.5" aria-hidden>
              {LIQUID_SCAN_ONBOARDING_STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step ? "w-6 bg-cyan-400/80" : "w-1.5 bg-white/15 hover:bg-white/25",
                  )}
                  onClick={() => setStep(i)}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-100"
                onClick={close}
              >
                Skip
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-slate-300"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <ChevronLeft className="mr-0.5 h-4 w-4" />
                  Back
                </Button>
                {isLast ? (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-cyan-500/90 text-slate-950 hover:bg-cyan-400"
                    onClick={close}
                  >
                    Got it
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-cyan-500/90 text-slate-950 hover:bg-cyan-400"
                    onClick={() =>
                      setStep((s) => Math.min(LIQUID_SCAN_ONBOARDING_STEPS.length - 1, s + 1))
                    }
                  >
                    Next
                    <ChevronRight className="ml-0.5 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
