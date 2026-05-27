"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart2, BookOpen, ChevronRight, Layers, LayoutGrid, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const PROMPT_CHIPS = [
  "Scan binder page",
  "Vendor calculator",
  "Open master catalog",
  "Open companion",
  "Identify graded cards",
  "Estimate market value",
  "Export to CSV",
] as const;

type StepId = "upload" | "extract" | "catalog" | "comps";

type StepDetails = {
  title: string;
  label: string;
  icon: typeof Layers;
  description: string;
  tips: string[];
  illustration?: string;
};

const STEPS: Record<StepId, StepDetails> = {
  upload: {
    title: "1. Capture & Drop",
    label: "Page Capture",
    icon: Layers,
    description: "Drop or take a photo of your binder page, slabs, or raw singles.",
    tips: [
      "Lay binder flat for uniform lighting.",
      "Avoid direct camera glares and reflections.",
      "Dense binder grids and screenshots — tiled vision extracts every visible card.",
    ],
  },
  extract: {
    title: "2. Vision Extract",
    label: "Laser Extraction",
    icon: Sparkles,
    description: "PGT AI isolates bounds, extracts stamps, conditions, and slab details.",
    tips: [
      "Crops each card boundary automatically.",
      "Extracts printed text, languages, and stamps.",
      "Adjust coordinates manually via 'Adjust Crop' if offset.",
    ],
  },
  catalog: {
    title: "3. Catalog Sync",
    label: "Franchise Sync",
    icon: BookOpen,
    description: "Card details are validated against official franchise databases.",
    tips: [
      "Resolves Pokémon, MTG, Yu-Gi-Oh!, Lorcana, and One Piece.",
      "Use 'Franchise Override' selector to manually force lookups.",
      "Confirm candidate matches to sync catalog details.",
    ],
  },
  comps: {
    title: "4. Comps Valuation",
    label: "Market Analysis",
    icon: BarChart2,
    description: "Aggregates active & sold comps from eBay and TCGPlayer to compute FMV.",
    tips: [
      "FMV median calculation updates instantly.",
      "Interactive SVG dot tooltips show exact sale references.",
      "Exclude outlying comps to tailor pricing precision.",
    ],
  },
};

export function EmptyScannerState({
  onChipClick,
  className,
}: {
  onChipClick: (text: string) => void;
  className?: string;
}) {
  const [activeStep, setActiveStep] = useState<StepId>("upload");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-8 text-center lg:max-w-none lg:px-2 xl:px-4",
        className,
      )}
    >
      {/* Upgraded Branding Logo Mark */}
      <div className="sc-glow-border mb-5 flex h-14 w-14 items-center justify-center rounded-2xl sc-glass shadow-[0_0_15px_rgba(34,211,238,0.15)] border-cyan-500/25">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/logo-mark.png"
          alt="PGT Logo"
          className="h-9 w-9 object-contain"
        />
      </div>

      <h1 className="text-balance text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
        PGT Liquid Scan
      </h1>
      <p className="mt-3 max-w-lg text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
        Scan binder pages, slabs, or raw cards in one integrated pipeline. Liquid Scan detects the game,
        matches catalogs, and compiles live comps.
      </p>

      {/* Suggested Prompt Chips */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {PROMPT_CHIPS.map((chip, i) => (
          <motion.button
            key={chip}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.35 }}
            onClick={() => onChipClick(chip)}
            className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-400/30 hover:bg-cyan-500/10 hover:text-cyan-100"
          >
            {chip}
          </motion.button>
        ))}
      </div>

      {/* Interactive Walkthrough Infographic */}
      <div className="mt-12 w-full text-left border-t border-white/6 pt-8">
        <div className="flex items-center gap-2 justify-center mb-6">
          <LayoutGrid className="h-4 w-4 text-cyan-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 font-mono">
            Liquid Scan Guide & Workflow
          </h2>
        </div>

        {/* Step Navigation Track */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {(Object.keys(STEPS) as StepId[]).map((stepId) => {
            const step = STEPS[stepId];
            const isActive = activeStep === stepId;
            const StepIcon = step.icon;

            return (
              <button
                key={stepId}
                type="button"
                onClick={() => setActiveStep(stepId)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl p-3 border text-left transition duration-200",
                  isActive
                    ? "bg-cyan-500/10 border-cyan-400/30 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.06)]"
                    : "bg-white/[0.015] border-white/5 hover:bg-white/[0.04] text-slate-400 hover:text-slate-200"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <StepIcon className={cn("h-3.5 w-3.5", isActive ? "text-cyan-400" : "text-slate-500")} />
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider">{step.label}</span>
                </div>
                <span className="text-xs font-semibold mt-1 truncate">{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step Details Body with Illustration Panel */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 rounded-2xl border border-white/6 bg-white/[0.02] p-5 sc-glass">
          <div className="md:col-span-7 flex flex-col justify-between min-w-0">
            <div>
              <span className="text-[10px] font-bold font-mono text-cyan-400 uppercase tracking-widest bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
                {STEPS[activeStep].title}
              </span>
              <h3 className="text-base font-semibold text-slate-100 mt-2">
                {STEPS[activeStep].description}
              </h3>
              <ul className="mt-4 space-y-2">
                {STEPS[activeStep].tips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
                    <ChevronRight className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-6 text-[10px] text-slate-500">
              * Click the guide tabs above to explore other workflow phases.
            </p>
          </div>

          {/* Visual Illustration Panel featuring user's test images */}
          <div className="md:col-span-5 flex flex-col justify-center">
            {activeStep === "upload" && (
              <div className="space-y-2">
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Example Binder Captures</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-slate-900 h-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/branding/binder-test-1.jpg" alt="Binder Test 1" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-300" />
                    <span className="absolute bottom-1.5 right-1.5 text-[8px] bg-slate-950/80 text-cyan-300 px-1 py-0.5 rounded font-mono border border-cyan-500/20">Sample 1</span>
                  </div>
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-slate-900 h-28">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/branding/binder-test-2.jpg" alt="Binder Test 2" className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-300" />
                    <span className="absolute bottom-1.5 right-1.5 text-[8px] bg-slate-950/80 text-cyan-300 px-1 py-0.5 rounded font-mono border border-cyan-500/20">Sample 2</span>
                  </div>
                </div>
              </div>
            )}

            {activeStep === "extract" && (
              <div className="relative rounded-xl border border-white/10 overflow-hidden bg-slate-900/60 p-3 h-32 flex flex-col justify-center items-center text-center">
                <div className="absolute inset-0 sc-laser-scan opacity-60" />
                <div className="relative z-10 space-y-1">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-950 text-cyan-300 animate-pulse">
                    <Layers className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200 mt-1">Extracting Specimens</p>
                  <p className="text-[10px] text-slate-500">Auto-cropping boundaries...</p>
                </div>
              </div>
            )}

            {activeStep === "catalog" && (
              <div className="rounded-xl border border-white/10 bg-slate-950 p-3 text-xs space-y-2 h-32 overflow-hidden flex flex-col justify-center">
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-white/5 pb-1">
                  <span>Match Registry</span>
                  <span className="text-emerald-400 font-mono">98% Match</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-200 truncate">Dark Charizard</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Team Rocket · #4/82 · 1999</p>
                </div>
                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[9px] text-emerald-300 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Catalog match confirmed
                </div>
              </div>
            )}

            {activeStep === "comps" && (
              <div className="rounded-xl border border-white/10 bg-slate-950 p-2 text-xs space-y-2 h-32 flex flex-col justify-between overflow-hidden">
                <div className="h-16 flex items-end justify-between px-1">
                  <div className="w-1.5 bg-slate-800 rounded-t h-4" />
                  <div className="w-1.5 bg-cyan-500 rounded-t h-8" />
                  <div className="w-1.5 bg-slate-800 rounded-t h-6" />
                  <div className="w-1.5 bg-cyan-500 rounded-t h-12" />
                  <div className="w-1.5 bg-cyan-500 rounded-t h-10 animate-pulse" />
                  <div className="w-1.5 bg-slate-800 rounded-t h-7" />
                  <div className="w-1.5 bg-cyan-500 rounded-t h-14" />
                </div>
                <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-[9px]">
                  <span className="text-slate-400 font-semibold">FMV Basis</span>
                  <span className="text-cyan-400 font-mono font-bold">$260.00 Median</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
