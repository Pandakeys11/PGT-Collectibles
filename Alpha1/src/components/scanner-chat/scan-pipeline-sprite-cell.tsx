"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { animatedSpriteSources } from "@/lib/companion/sprites";
import type { ScanPipelineAccent, ScanPipelineSprite } from "@/lib/scanner-chat/scan-pipeline-evolution";
import { cn } from "@/lib/cn";

const EVO_MOTION = { duration: 0.48, ease: [0.22, 1, 0.36, 1] as const };

export function ScanPipelineSpriteCell({
  sprite,
  lineAccent,
  evolving,
  rare,
  transformLegendary,
  variant = "standalone",
  className,
}: {
  sprite: ScanPipelineSprite;
  lineAccent: ScanPipelineAccent;
  evolving?: boolean;
  rare?: boolean;
  transformLegendary?: boolean;
  /** Inside TCG art window — no extra frame. */
  variant?: "standalone" | "art";
  className?: string;
}) {
  const sources = useMemo(
    () => animatedSpriteSources(sprite.nationalId, sprite.slug),
    [sprite.nationalId, sprite.slug],
  );
  const [srcIndex, setSrcIndex] = useState(0);
  const src = sources[srcIndex] ?? sources[0];

  useEffect(() => {
    setSrcIndex(0);
  }, [sprite.slug]);

  if (variant === "art") {
    return (
      <div
        className={cn(
          "sc-scan-pipeline-cell sc-scan-pipeline-cell--art relative w-full",
          className,
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={sprite.slug}
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -4 }}
            transition={EVO_MOTION}
            className={cn(
              "flex w-full items-end justify-center",
              evolving && "sc-scan-pipeline-cell--evolving",
            )}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={sprite.name}
                className="sc-scan-pipeline-sprite max-h-[7.25rem] w-auto max-w-full object-contain object-bottom sm:max-h-[8rem]"
                style={{ imageRendering: "pixelated" }}
                draggable={false}
                onError={() => {
                  if (srcIndex < sources.length - 1) setSrcIndex((i) => i + 1);
                }}
              />
            ) : (
              <span className="pb-4 text-xs text-muted">{sprite.name}</span>
            )}
          </motion.div>
        </AnimatePresence>
        {evolving ? (
          <motion.span
            key={`flash-${sprite.slug}`}
            className="sc-scan-pipeline-flash pointer-events-none absolute inset-0"
            initial={{ opacity: 0.65 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            aria-hidden
          />
        ) : null}
        {transformLegendary ? (
          <p className="sr-only">Legendary transform</p>
        ) : null}
      </div>
    );
  }

  const plateTone =
    lineAccent === "fire"
      ? "border-orange-500/25 bg-gradient-to-b from-orange-950/30 to-black/60"
      : lineAccent === "grass"
        ? "border-emerald-500/25 bg-gradient-to-b from-emerald-950/30 to-black/60"
        : lineAccent === "water"
          ? "border-sky-500/25 bg-gradient-to-b from-sky-950/30 to-black/60"
          : "border-amber-400/30 bg-gradient-to-b from-amber-950/25 to-black/60";

  return (
    <div className={cn("sc-scan-pipeline-cell flex w-full flex-col items-center", className)}>
      {rare ? (
        <span className="sc-scan-pipeline-rare-badge mb-2 rounded-full bg-amber-500/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200/90 ring-1 ring-amber-400/25">
          Rare scan
        </span>
      ) : null}
      <div
        className={cn(
          "relative flex h-[7.5rem] w-full max-w-[11rem] items-end justify-center overflow-hidden rounded-2xl border sm:h-[8.75rem] sm:max-w-[12.5rem]",
          plateTone,
          evolving && "sc-scan-pipeline-cell--evolving",
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={sprite.slug}
            initial={{ opacity: 0, scale: 0.88, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.06, y: -6 }}
            transition={EVO_MOTION}
            className="flex h-full w-full items-end justify-center px-2 pb-2"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={sprite.name}
                className="sc-scan-pipeline-sprite max-h-[6.5rem] w-auto max-w-full object-contain object-bottom sm:max-h-[7.75rem]"
                style={{ imageRendering: "pixelated" }}
                draggable={false}
                onError={() => {
                  if (srcIndex < sources.length - 1) setSrcIndex((i) => i + 1);
                }}
              />
            ) : (
              <span className="pb-6 text-xs text-muted">{sprite.name}</span>
            )}
          </motion.div>
        </AnimatePresence>
        {evolving ? (
          <motion.span
            key={`flash-${sprite.slug}`}
            className="sc-scan-pipeline-flash pointer-events-none"
            initial={{ opacity: 0.7 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            aria-hidden
          />
        ) : null}
      </div>
      <p className="mt-2 text-center text-xs font-medium text-slate-300">
        {sprite.name}
        {transformLegendary ? (
          <span className="mt-0.5 block text-[10px] font-normal text-amber-200/80">
            Legendary transform
          </span>
        ) : null}
      </p>
    </div>
  );
}
