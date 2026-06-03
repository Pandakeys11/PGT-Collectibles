"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart2,
  BookOpen,
  Calculator,
  ExternalLink,
  Gavel,
  Gamepad2,
  Gift,
  Radio,
  Sparkles,
  TrendingUp,
  Tv,
  type LucideIcon,
} from "lucide-react";
import { LiveMarketTickerPill } from "@/components/scanner-chat/live-market-ticker-pill";
import { MarketDailyBriefPanel } from "@/components/scanner-chat/market-daily-brief-panel";
import { MarketIdleSourceHub } from "@/components/scanner-chat/market-idle-source-hub";
import { useLiveMarketTicker } from "@/hooks/use-live-market-ticker";
import { useMarketDailyBrief } from "@/hooks/use-market-daily-brief";
import { ONE_THIRTY_POINT_CARDS_BASE } from "@/lib/market/one-thirty-point-urls";
import { SLABZ_RIP_DEMO_MODE, SLABZ_RIP_PARTNERSHIP } from "@/lib/partners/slabz-rip-preview";
import { cn } from "@/lib/cn";

export type MarketIntelIdleAction =
  | "live-market"
  | "ebay-ending"
  | "slabz-rip"
  | "catalog"
  | "calculator"
  | "companion"
  | "youtube"
  | "arcade";

type SpotlightDef = {
  id: MarketIntelIdleAction | "130point";
  title: string;
  subtitle: string;
  cta: string;
  border: string;
  bg: string;
  icon: LucideIcon;
  externalUrl?: string;
  comingSoon?: boolean;
  demoMode?: boolean;
};

const SPOTLIGHTS: SpotlightDef[] = [
  {
    id: "live-market",
    title: "Live market pulse",
    subtitle: "FMV movers, momentum lanes, and chase spotlights from the master catalog.",
    cta: "Open pulse",
    border: "border-sky-500/35",
    bg: "from-sky-500/20 via-sky-950/40 to-transparent",
    icon: TrendingUp,
  },
  {
    id: "ebay-ending",
    title: "eBay ending soon",
    subtitle: "Auctions closing in the next hour — raw and graded picks worth watching.",
    cta: "View auctions",
    border: "border-rose-500/35",
    bg: "from-rose-500/20 via-rose-950/40 to-transparent",
    icon: Gavel,
  },
  {
    id: "slabz-rip",
    title: "Slabz Pack Ripz",
    subtitle: `${SLABZ_RIP_PARTNERSHIP.collaboration} — ${SLABZ_RIP_DEMO_MODE ? "Demo open for testing. " : ""}${SLABZ_RIP_PARTNERSHIP.tagline}`,
    cta: SLABZ_RIP_DEMO_MODE ? "Try demo" : "Open Slabz",
    border: "border-cyan-400/35",
    bg: "from-cyan-500/20 via-cyan-950/40 to-transparent",
    icon: Gift,
    demoMode: SLABZ_RIP_DEMO_MODE,
  },
  {
    id: "arcade",
    title: "PGT Arcade",
    subtitle: "Retro emulators embedded from PGTools — wallet sign-in inside the arcade frame.",
    cta: "Open arcade",
    border: "border-indigo-500/35",
    bg: "from-indigo-500/20 via-indigo-950/40 to-transparent",
    icon: Gamepad2,
  },
  {
    id: "catalog",
    title: "Master catalog",
    subtitle: "Browse sets, chase cards, and prefill scans from the PGT registry.",
    cta: "Open catalog",
    border: "border-amber-500/30",
    bg: "from-amber-500/15 via-amber-950/35 to-transparent",
    icon: BookOpen,
  },
  {
    id: "130point",
    title: "130 Point sold history",
    subtitle: "Cross-marketplace sold comps — eBay, Goldin, PWCC, Heritage, and more.",
    cta: "Browse sales",
    border: "border-orange-500/35",
    bg: "from-orange-500/20 via-orange-950/40 to-transparent",
    icon: BarChart2,
    externalUrl: ONE_THIRTY_POINT_CARDS_BASE,
  },
];

const QUICK_TILES: Array<{
  id: MarketIntelIdleAction | "130point";
  label: string;
  icon: LucideIcon;
  accent: string;
  externalUrl?: string;
  comingSoon?: boolean;
  demoMode?: boolean;
}> = [
  { id: "live-market", label: "Live pulse", icon: Radio, accent: "text-sky-300" },
  { id: "ebay-ending", label: "eBay ending", icon: Gavel, accent: "text-rose-300" },
  {
    id: "slabz-rip",
    label: SLABZ_RIP_DEMO_MODE ? "Slabz (demo)" : "Slabz rip",
    icon: Gift,
    accent: "text-cyan-300",
    demoMode: SLABZ_RIP_DEMO_MODE,
  },
  { id: "catalog", label: "Catalog", icon: BookOpen, accent: "text-amber-300" },
  { id: "calculator", label: "Calculator", icon: Calculator, accent: "text-emerald-300" },
  { id: "companion", label: "Companion", icon: Sparkles, accent: "text-violet-300" },
  { id: "youtube", label: "PGT TV", icon: Tv, accent: "text-fuchsia-300" },
  { id: "arcade", label: "PGT Arcade", icon: Gamepad2, accent: "text-indigo-300" },
  {
    id: "130point",
    label: "130 Point",
    icon: ExternalLink,
    accent: "text-orange-300",
    externalUrl: ONE_THIRTY_POINT_CARDS_BASE,
  },
];

const ROTATE_MS = 7000;

function IntelLiveTickerStrip({ onOpen }: { onOpen: () => void }) {
  const { loading, error, paused, setPaused, bannerPills, reload } = useLiveMarketTicker();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [bannerPills.length]);

  useEffect(() => {
    if (bannerPills.length <= 1 || paused) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % bannerPills.length);
    }, 5500);
    return () => window.clearInterval(t);
  }, [bannerPills.length, paused]);

  const active = bannerPills[idx] ?? bannerPills[0];

  if (loading && bannerPills.length === 0) {
    return (
      <div className="sc-intel-idle-live flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-2.5 py-2 text-[10px] text-muted">
        <TrendingUp className="h-3.5 w-3.5 shrink-0 animate-pulse text-sky-400" aria-hidden />
        Loading live pulse…
      </div>
    );
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => {
          if (error) void reload();
          else onOpen();
        }}
        className="sc-intel-idle-live w-full rounded-xl border border-dashed border-sky-500/25 bg-sky-500/[0.04] px-3 py-2.5 text-left text-[10px] text-sky-200/80 transition hover:border-sky-400/40 hover:bg-sky-500/10"
      >
        <span className="font-semibold text-sky-100">Live market pulse</span>
        <span className="mt-0.5 block text-muted">
          {error ? "Tap to retry · " : ""}
          Opens rotating FMV movers while you wait
        </span>
      </button>
    );
  }

  return (
    <LiveMarketTickerPill
      slide={active.slide}
      laneLabel={active.lane.label}
      slideIndex={idx}
      slideTotal={bannerPills.length}
      onClick={onOpen}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="sc-intel-idle-live w-full"
    />
  );
}

function runSpotlightAction(
  spot: SpotlightDef,
  onAction: (action: MarketIntelIdleAction) => void,
) {
  if (spot.externalUrl) {
    window.open(spot.externalUrl, "_blank", "noopener,noreferrer");
    return;
  }
  onAction(spot.id as MarketIntelIdleAction);
}

export function MarketIntelligenceIdleShowcase({
  onAction,
  hasSession = false,
  variant = "full",
  className,
}: {
  onAction: (action: MarketIntelIdleAction) => void;
  /** Scan session exists but no card selected yet. */
  hasSession?: boolean;
  variant?: "full" | "compact";
  className?: string;
}) {
  const rotatePool = SPOTLIGHTS;
  const [spotIdx, setSpotIdx] = useState(0);
  const compact = variant === "compact";
  const { data: dailyBrief } = useMarketDailyBrief();
  const hotSetName = dailyBrief?.hotSetNames?.[0] ?? null;
  const spot = rotatePool[spotIdx] ?? rotatePool[0];
  const SpotIcon = spot?.icon ?? TrendingUp;

  useEffect(() => {
    if (rotatePool.length <= 1) return;
    const t = window.setInterval(() => {
      setSpotIdx((i) => (i + 1) % rotatePool.length);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [rotatePool.length]);

  return (
    <section
      className={cn("sc-intel-idle-showcase min-w-0 space-y-3", className)}
      aria-label="Market tools while idle"
    >
      {!hasSession ? (
        <div className="sc-intel-idle-hero rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
            Liquid Scan intel rail
          </p>
          <p className="mt-1 text-xs leading-snug text-slate-400">
            Run a scan to unlock per-card FMV, comps, and graded lanes — or explore live market tools
            below while you wait.
          </p>
        </div>
      ) : null}

      <MarketDailyBriefPanel compact={compact} />

      <MarketIdleSourceHub hotSetName={hotSetName} />

      <IntelLiveTickerStrip onOpen={() => onAction("live-market")} />

      {spot ? (
        <div className="relative min-h-[7.25rem]">
          <AnimatePresence mode="wait">
            <motion.button
              key={spot.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.28 }}
              onClick={() => runSpotlightAction(spot, onAction)}
              className={cn(
                "sc-intel-idle-banner group flex w-full flex-col rounded-xl border bg-gradient-to-br p-3 text-left transition hover:brightness-110",
                spot.border,
                spot.bg,
                spot.comingSoon && "sc-intel-idle-banner--soon opacity-75 saturate-[0.45] hover:brightness-100",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/30 ring-1 ring-white/10",
                      spot.comingSoon && "grayscale",
                    )}
                  >
                    <SpotIcon className="h-4 w-4 text-slate-100" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-100">{spot.title}</p>
                    {!compact ? (
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-slate-400">
                        {spot.subtitle}
                      </p>
                    ) : null}
                  </div>
                </div>
                {spot.demoMode ? (
                  <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-200/90">
                    Demo
                  </span>
                ) : spot.comingSoon ? (
                  <span className="shrink-0 rounded-full border border-slate-500/35 bg-slate-800/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-400">
                    Soon
                  </span>
                ) : spot.externalUrl ? (
                  <ExternalLink
                    className="h-3.5 w-3.5 shrink-0 text-slate-500 group-hover:text-slate-300"
                    aria-hidden
                  />
                ) : null}
              </div>
              <span
                className={cn(
                  "mt-2.5 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-white/10",
                  spot.comingSoon
                    ? "bg-slate-700/40 text-slate-400"
                    : "bg-white/10 text-emerald-200/90",
                )}
              >
                {spot.cta}
              </span>
              <div
                className="mt-2 flex gap-1"
                aria-hidden
              >
                {rotatePool.map((s, i) => (
                  <span
                    key={s.id}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i === spotIdx ? "bg-emerald-400/70" : "bg-white/10",
                    )}
                  />
                ))}
              </div>
            </motion.button>
          </AnimatePresence>
        </div>
      ) : null}

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Quick open
        </p>
        <div
          className={cn(
            "mt-1.5 grid gap-1.5",
            compact ? "grid-cols-4" : "grid-cols-2",
          )}
        >
          {QUICK_TILES.map((tile) => {
            const Icon = tile.icon;
            const external = Boolean(tile.externalUrl);
            const shared = cn(
              "flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center transition",
              tile.comingSoon
                ? "sc-intel-idle-tile--soon border-white/6 bg-white/[0.02] opacity-70 saturate-[0.5] hover:opacity-85"
                : tile.demoMode
                  ? "border-cyan-400/15 bg-cyan-500/[0.04] hover:border-cyan-400/25 hover:bg-cyan-500/[0.08] active:scale-[0.98]"
                  : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.98]",
            );
            if (external && tile.externalUrl) {
              return (
                <a
                  key={tile.id}
                  href={tile.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={shared}
                >
                  <Icon className={cn("h-4 w-4", tile.accent)} aria-hidden />
                  <span className="w-full truncate text-[9px] font-medium text-slate-400">{tile.label}</span>
                </a>
              );
            }
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onAction(tile.id as MarketIntelIdleAction)}
                className={shared}
              >
                <Icon className={cn("h-4 w-4", tile.accent)} aria-hidden />
                <span className="w-full truncate text-[9px] font-medium text-slate-400">{tile.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
