"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Database, Radar, ShieldCheck, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pokeball } from "@/components/companion/pokeball";
import { PokemonSprite } from "@/components/companion/pokemon-sprite";
import { ScanBattleArena } from "@/components/scanner/scan-battle-arena";
import type { CompanionPokemon } from "@/lib/companion/pokemon-roster";
import type { CompanionState } from "@/lib/companion/schemas";
import { cn } from "@/lib/cn";
import { ENERGY_UI } from "@/lib/energy-ui";
import {
  pickRandomStarterPokemon,
  starterPrimaryEnergy,
} from "@/lib/scanner/workflow-starters";

const SCANNER_STEPS = [
  { step: "1", label: "Upload", detail: "Load images", icon: UploadCloud },
  { step: "2", label: "Detect", detail: "Find cards", icon: Radar },
  { step: "3", label: "Enrich", detail: "Resolve data", icon: Database },
  { step: "4", label: "Review", detail: "Verify output", icon: ShieldCheck },
] as const;

export type ScannerWorkflowStage = 0 | 1 | 2 | 3;

export function resolveScannerWorkflowStage(
  busy: boolean,
  progress: string | null,
  slotCount: number,
  specimenCount: number,
): ScannerWorkflowStage {
  if (specimenCount > 0) return 3;
  if (busy && /enrich|market|catalog/i.test(progress ?? "")) return 2;
  if (busy || slotCount > 0) return 1;
  return 0;
}

function WorkflowStageVisual({
  stage,
  starter,
  energyKey,
  attackRepeating,
}: {
  stage: ScannerWorkflowStage;
  starter: CompanionPokemon | null;
  energyKey: string;
  attackRepeating?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const glow = starter ? ENERGY_UI[starterPrimaryEnergy(starter)] : ENERGY_UI.electric;

  if (stage === 0) {
    return (
      <motion.div
        key="upload"
        className="relative flex flex-col items-center justify-center"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="scanner-workflow-aura scanner-workflow-aura--idle"
          aria-hidden
        />
        <Pokeball shake className="relative z-[1] max-w-[5.5rem]" />
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-energy-electric-3">
          Awaiting capture
        </p>
      </motion.div>
    );
  }

  if (!starter) {
    return (
      <div className="grid h-28 w-28 place-items-center rounded-full border border-dashed border-white/15 text-xs text-muted">
        …
      </div>
    );
  }

  if (stage === 1) {
    return (
      <motion.div
        key="detect"
        className="relative flex flex-col items-center"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.72, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.88 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
      >
        <motion.div
          className={cn("scanner-workflow-aura", `scanner-workflow-aura--${energyKey}`)}
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          aria-hidden
        />
        <motion.div className="scanner-starter-pop relative z-[1]">
          <PokemonSprite
            nationalId={starter.id}
            slug={starter.slug}
            name={starter.name}
            types={starter.types}
            display="animated"
            size="lg"
            className="h-28 w-28 sm:h-32 sm:w-32"
          />
        </motion.div>
        <motion.p
          className="mt-2 font-mono text-xs font-semibold text-primary"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {starter.name} joined the scan
        </motion.p>
      </motion.div>
    );
  }

  if (stage === 2) {
    return (
      <motion.div
        key="enrich"
        className="relative flex flex-col items-center"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
      >
        <motion.div
          className={cn("scanner-workflow-aura", `scanner-workflow-aura--${energyKey}`)}
          aria-hidden
        />
        <motion.div
          className={cn(
            "scanner-attack-lunge relative z-[1]",
            attackRepeating && "scanner-attack-lunge--repeat",
          )}
          initial={reduceMotion ? false : { x: -12 }}
          animate={{ x: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 22 }}
        >
          <PokemonSprite
            nationalId={starter.id}
            slug={starter.slug}
            name={starter.name}
            types={starter.types}
            display="animated"
            size="lg"
            className="h-28 w-28 sm:h-32 sm:w-32"
          />
        </motion.div>
        <motion.span
          className="scanner-attack-flash pointer-events-none absolute left-1/2 top-1/2 z-[2] h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, rgb(var(--energy-${energyKey}-glow) / 0.55) 0%, transparent 70%)`,
          }}
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: [0.4, 1.35, 1], opacity: [0, 0.85, 0] }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          aria-hidden
        />
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-energy-fighting-3">
          Resolving market data
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="review"
      className="relative flex flex-col items-center"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className={cn(
          "scanner-workflow-aura scanner-workflow-aura--powered",
          `scanner-workflow-aura--${energyKey}`,
          glow.glow,
        )}
        animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />
      <motion.div
        className="scanner-powered-sprite relative z-[1]"
        style={{
          filter: `drop-shadow(0 0 22px rgb(var(--energy-${energyKey}-glow) / 0.55)) brightness(1.1) saturate(1.15)`,
        }}
        animate={reduceMotion ? undefined : { scale: [1, 1.05, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <PokemonSprite
          nationalId={starter.id}
          slug={starter.slug}
          name={starter.name}
          types={starter.types}
          display="animated"
          size="lg"
          className="h-28 w-28 sm:h-32 sm:w-32"
        />
      </motion.div>
      <div
        className={cn(
          "mt-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider",
          glow.ring,
          glow.textSoft,
        )}
      >
        Powered up · {glow.label}
      </div>
    </motion.div>
  );
}

export function ScannerWorkflowPanel({
  busy,
  progress,
  slotCount,
  specimenCount,
  companionState,
  companionBusy = false,
  onBattleReward,
}: {
  busy: boolean;
  progress: string | null;
  slotCount: number;
  specimenCount: number;
  companionState?: CompanionState | null;
  companionBusy?: boolean;
  onBattleReward?: () => void;
}) {
  const activeIndex = resolveScannerWorkflowStage(busy, progress, slotCount, specimenCount);
  const [starter, setStarter] = useState<CompanionPokemon | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    if (activeIndex === 0 && !busy && specimenCount === 0 && slotCount === 0) {
      lockedRef.current = false;
      setStarter(null);
      return;
    }
    if (activeIndex >= 1 && !lockedRef.current) {
      lockedRef.current = true;
      setStarter(pickRandomStarterPokemon());
    }
  }, [activeIndex, busy, specimenCount, slotCount]);

  const energyKey = useMemo(
    () => (starter ? starterPrimaryEnergy(starter) : "electric"),
    [starter],
  );
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout
      className="mt-4 overflow-hidden rounded-lg border border-energy-electric-1/20 neo-inset"
    >
      <div className="border-b border-white/[0.06] bg-panel-raised/30 px-3 py-3 sm:px-4">
        <motion.div
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          layout
        >
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-energy-electric-2">
              Scanner workflow
            </p>
            <p className="mt-1 text-sm text-muted">
              {progress ??
                (slotCount > 0 ? "Capture loaded. Start scan when ready." : "Upload photos to begin.")}
            </p>
          </div>
          <div className="rounded-md border border-border-subtle bg-canvas/60 px-3 py-2 font-mono text-xs text-primary">
            {slotCount} files / {specimenCount} cards
          </div>
        </motion.div>

        <div
          className={cn(
            "scanner-workflow-stage relative mt-4",
            activeIndex === 0
              ? "flex min-h-[9.5rem] items-center justify-center sm:min-h-[11rem]"
              : "min-h-[31rem]",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(var(--energy-electric-glow)/0.12),transparent_68%)]" />
          {activeIndex === 0 ? (
            <AnimatePresence mode="wait">
              <WorkflowStageVisual
                key={activeIndex}
                stage={activeIndex}
                starter={starter}
                energyKey={energyKey}
                attackRepeating={false}
              />
            </AnimatePresence>
          ) : (
            <ScanBattleArena
              active={busy || slotCount > 0 || specimenCount > 0}
              busy={busy}
              progress={progress}
              companionState={companionState ?? null}
              companionBusy={companionBusy}
              fallbackPokemon={starter}
              onBattleReward={onBattleReward}
            />
          )}
        </div>
      </div>

      <motion.div className="grid gap-2 p-3 sm:grid-cols-4">
        {SCANNER_STEPS.map(({ step, label, detail, icon: Icon }, index) => {
          const active = index === activeIndex;
          const done = index < activeIndex;
          return (
            <motion.div
              key={label}
              layout
              className={cn(
                "relative overflow-hidden rounded-lg border p-3 transition-colors",
                active
                  ? "border-energy-electric-1/45 bg-energy-electric-1/10 energy-glow-electric"
                  : done
                    ? "border-energy-grass-1/25 bg-energy-grass-1/8"
                    : "border-white/[0.08] bg-white/[0.035]",
              )}
            >
              {active ? (
                <motion.div
                  className="absolute inset-x-0 top-0 h-px bg-energy-electric-2"
                  layoutId="scanner-workflow-active-line"
                />
              ) : null}
              <motion.div
                className="flex items-center justify-between"
                animate={active && !reduceMotion ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <span className="font-mono text-xs text-faint">{step}</span>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-energy-electric-3" : done ? "text-energy-grass-2" : "text-faint",
                  )}
                />
              </motion.div>
              <p
                className={cn(
                  "mt-2 text-sm font-semibold",
                  active ? "text-primary" : done ? "text-slate-300" : "text-slate-500",
                )}
              >
                {label}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-faint">{detail}</p>
              {active ? (
                <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-energy-electric-2"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: busy ? 1.2 : 2.4,
                      repeat: busy ? Infinity : 0,
                      ease: "easeInOut",
                    }}
                  />
                </div>
              ) : null}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
