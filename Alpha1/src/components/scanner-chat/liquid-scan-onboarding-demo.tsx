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
import { cn } from "@/lib/cn";

export const LIQUID_SCAN_ONBOARDING_STORAGE_KEY = "pgt-liquid-scan-onboarding-v1";

export type LiquidScanOnboardingStep = {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  icon: typeof Camera;
  accent: "cyan" | "emerald" | "amber";
  preview: React.ReactNode;
};

function MockChatBubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3 py-2 text-[11px] leading-snug",
          isUser
            ? "rounded-br-md bg-cyan-500/15 text-cyan-50 ring-1 ring-cyan-400/25"
            : "rounded-bl-md sc-glass text-slate-200",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function MockCardRow() {
  return (
    <div className="sc-glass-raised flex items-center gap-2 rounded-xl p-2">
      <div className="h-10 w-8 shrink-0 rounded-md bg-gradient-to-br from-slate-700 to-slate-900 ring-1 ring-white/10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-slate-100">Raichu · Fossil Rare</p>
        <p className="text-[10px] text-slate-500">PSA 9 · Catalog match 94%</p>
      </div>
      <p className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-400">$142</p>
    </div>
  );
}

function MockMarketStrip() {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {[
        { label: "PSA 10", value: "$380" },
        { label: "PSA 9", value: "$142" },
        { label: "Raw", value: "$28" },
      ].map((tier) => (
        <div key={tier.label} className="sc-glass rounded-lg px-2 py-1.5 text-center">
          <p className="text-[9px] uppercase tracking-wide text-slate-500">{tier.label}</p>
          <p className="text-[11px] font-semibold tabular-nums text-slate-100">{tier.value}</p>
        </div>
      ))}
    </div>
  );
}

export const LIQUID_SCAN_ONBOARDING_STEPS: LiquidScanOnboardingStep[] = [
  {
    id: "upload",
    title: "Drop cards into chat",
    subtitle: "Step 1 · Capture",
    body: "Photograph slabs or binder pages. Liquid Scan accepts multiple images in one session — same flow you use after sign-in.",
    icon: Camera,
    accent: "cyan",
    preview: (
      <div className="space-y-2">
        <MockChatBubble role="user">Binder page — 6 cards, Fossil set</MockChatBubble>
        <div className="flex gap-1.5 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-14 flex-1 rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 ring-1 ring-white/8"
            />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "detect",
    title: "AI vision identifies each card",
    subtitle: "Step 2 · Extract",
    body: "Vision reads name, set, grade, cert, and lane (raw vs graded). Results stream in the chat feed with confidence cues.",
    icon: Sparkles,
    accent: "emerald",
    preview: (
      <div className="space-y-2">
        <MockChatBubble role="assistant">
          <span className="text-emerald-400/90">Scan complete</span> — 6 specimens detected
        </MockChatBubble>
        <MockCardRow />
        <MockCardRow />
      </div>
    ),
  },
  {
    id: "catalog",
    title: "Catalog + registry match",
    subtitle: "Step 3 · Identity",
    body: "Each hit links to the master catalog and graded registry when a cert is visible — one identity for FMV and exports.",
    icon: Droplets,
    accent: "cyan",
    preview: (
      <div className="sc-glass-raised space-y-2 rounded-xl p-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-400/90">Catalog match</p>
        <p className="text-[11px] text-slate-200">Raichu · Fossil #14 · 1999</p>
        <p className="text-[10px] text-slate-500">PSA cert verified · Population on file</p>
      </div>
    ),
  },
  {
    id: "market",
    title: "FMV, solds, and hub links",
    subtitle: "Step 4 · Market",
    body: "Scan Intelligence shows grade-aware FMV, recent eBay solds, listings, and one-tap links to Card Ladder, ALT, and more.",
    icon: LineChart,
    accent: "emerald",
    preview: (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] text-slate-500">FMV (PSA 9)</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-400">$142</p>
        </div>
        <MockMarketStrip />
      </div>
    ),
  },
  {
    id: "ask",
    title: "Ask Liquid Scan anything",
    subtitle: "Step 5 · Research",
    body: "Type questions about comps, pop, or pricing. Export CSV when you are done — your session matches this workspace exactly.",
    icon: MessageSquare,
    accent: "cyan",
    preview: (
      <div className="space-y-2">
        <MockChatBubble role="user">What did PSA 10 sell for last 60 days?</MockChatBubble>
        <MockChatBubble role="assistant">
          Last 3 sold comps average <span className="text-emerald-400">$372</span> — tap a row to open eBay sold search.
        </MockChatBubble>
      </div>
    ),
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
        hideClose
        className="scanner-chat-root w-[min(96vw,28rem)] max-h-[min(92dvh,40rem)] border-white/8 bg-[rgb(var(--sc-panel))] p-0 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]"
      >
        <div className="sc-glow-border rounded-2xl">
          <div className="border-b border-white/6 px-5 pb-4 pt-5">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-cyan-400" aria-hidden />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-400/90">
                PGT Liquid Scan
              </p>
            </div>
            <DialogTitle className="mt-2 font-display text-xl font-semibold text-slate-50">
              {current.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">{current.subtitle}</DialogDescription>
          </div>

          <div className="px-5 py-4">
            <div
              className={cn(
                "mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1",
                accentRing[current.accent],
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <p className="text-sm leading-relaxed text-slate-300">{current.body}</p>
            <div className="sc-glass-raised mt-4 rounded-xl p-3">{current.preview}</div>

            <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
              {LIQUID_SCAN_ONBOARDING_STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === step ? "w-6 bg-cyan-400/80" : "w-1.5 bg-white/15",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/6 px-5 py-4">
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
                <Button type="button" size="sm" className="bg-cyan-500/90 text-slate-950 hover:bg-cyan-400" onClick={close}>
                  Got it
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="bg-cyan-500/90 text-slate-950 hover:bg-cyan-400"
                  onClick={() => setStep((s) => Math.min(LIQUID_SCAN_ONBOARDING_STEPS.length - 1, s + 1))}
                >
                  Next
                  <ChevronRight className="ml-0.5 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
