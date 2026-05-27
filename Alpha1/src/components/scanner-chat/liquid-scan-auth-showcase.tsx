"use client";

import { useState } from "react";
import { Droplets, Play } from "lucide-react";
import { BrandLogo } from "@/components/branding/brand-logo";
import { Button } from "@/components/ui/button";
import {
  LIQUID_SCAN_ONBOARDING_STEPS,
  LiquidScanOnboardingDemo,
} from "@/components/scanner-chat/liquid-scan-onboarding-demo";
import { cn } from "@/lib/cn";

/** Left rail on sign-in — Liquid Scan infographic (matches live workspace tokens). */
export function LiquidScanAuthShowcase() {
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <aside className="scanner-chat-root relative hidden overflow-hidden rounded-2xl lg:flex lg:flex-col">
      <div className="sc-glow-border flex min-h-full flex-col rounded-2xl">
        <div className="sc-glass flex flex-1 flex-col p-8 xl:p-10">
          <BrandLogo variant="auth" href={null} className="[&_img]:brightness-110" />
          <div className="mt-6 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-cyan-400" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-400/90">
              What you get after sign-in
            </p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The same AI workspace you will land in — scan, match, price, and export without switching apps.
          </p>

          <ol className="mt-6 space-y-3">
            {LIQUID_SCAN_ONBOARDING_STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.id}
                  className="sc-glass-raised flex gap-3 rounded-xl p-3 transition hover:border-white/10"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums ring-1",
                      step.accent === "emerald"
                        ? "bg-emerald-400/10 text-emerald-400 ring-emerald-400/25"
                        : "bg-cyan-400/10 text-cyan-400 ring-cyan-400/25",
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                      <p className="text-sm font-medium text-slate-100">{step.title}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{step.hook}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          <Button
            type="button"
            size="sm"
            className="mt-6 w-full bg-cyan-500/90 text-slate-950 hover:bg-cyan-400"
            onClick={() => setTourOpen(true)}
          >
            <Play className="mr-1.5 h-4 w-4" />
            Take the 5-step tour
          </Button>
          <p className="mt-3 text-center text-[10px] text-slate-600">
            Interactive preview · same UI as Liquid Scan
          </p>
        </div>
      </div>

      <LiquidScanOnboardingDemo open={tourOpen} onOpenChange={setTourOpen} />
    </aside>
  );
}
