"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BarChart3,
  BadgeCheck,
  Bell,
  BookOpen,
  Brain,
  Heart,
  Camera,
  ChevronRight,
  CircleDollarSign,
  Crosshair,
  Cpu,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileJson,
  FileText,
  Gauge,
  HardDrive,
  ImageIcon,
  Layers3,
  Loader2,
  Maximize2,
  PanelRightOpen,
  Radar,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Settings,
  Trash2,
  TrendingUp,
  UploadCloud,
  WandSparkles,
  Wifi,
  X,
} from "lucide-react";
import { CatalogPrefillBootstrap } from "@/components/scanner/catalog-prefill-bootstrap";
import { ScannerWorkflowPanel } from "@/components/scanner/scanner-workflow-panel";
import { PokedexBrowser } from "@/components/pokedex/pokedex-browser";
import { EvidenceCropDialog } from "@/components/scanner/evidence-crop-dialog";
import { EvidenceRail } from "@/components/scanner/evidence-rail";
import { InsightCanvas } from "@/components/scanner/insight-canvas";
import { MarketEvidenceTable } from "@/components/scanner/market-evidence-table";
import { SourceChips } from "@/components/scanner/source-chips";
import { SpecimenEditFields } from "@/components/scanner/specimen-edit-fields";
import { SpecimenMarketSummary } from "@/components/scanner/specimen-market-summary";
import { VerificationPill } from "@/components/ui/verification-pill";
import {
  useScanSession,
  type ScanImageSlot,
  type ScanLaneMode,
  type ScanSpecimen,
} from "@/hooks/use-scan-session";
import { cn } from "@/lib/cn";
import { downloadSpecimensCsv, downloadSpecimensJson } from "@/lib/scan/export";
import {
  formatFairMarketValueHero,
  marketDataReady,
  summarizeSources,
} from "@/lib/scan/sheet-present";
import {
  formatAskingPrice,
  formatAskingPriceCompact,
  formatSpecimenMetaLine,
  formatSpecimenSubtitle,
} from "@/lib/scan/specimen-present";
import { getCardDisplayTitle } from "@/lib/scan/card-display";
import { getReviewQueueCardDisplay } from "@/lib/scan/review-queue-present";
import { formatGradedSlabTag } from "@/lib/scan/graded-slab";
import { ScanLimitBanner } from "@/components/billing/scan-limit-banner";
import { ScanQuotaChip } from "@/components/billing/scan-quota-chip";
import { ScanQuotaTip } from "@/components/billing/scan-quota-tip";
import { AuthControls } from "@/components/auth/auth-controls";
import { useScanQuota, type AccountQuota } from "@/hooks/use-scan-quota";
import type { ScanLimitPayload } from "@/lib/scan/scan-limit-error";
import { BrandLogo } from "@/components/branding/brand-logo";
import { CompanionDock } from "@/components/companion/companion-dock";
import { CompanionPanel } from "@/components/companion/companion-panel";
import { useCompanion } from "@/hooks/use-companion";
import { useActiveThemeEnergy } from "@/hooks/use-active-theme-energy";
import { ThemeControl } from "@/components/shell/theme-control";
import { moduleFromViewParam, SCANNER_PATH, scannerHref } from "@/lib/app-routes";
import { confidenceToEnergy, type EnergyType } from "@/lib/energy-theme";
import { ENERGY_UI, energyNavClasses } from "@/lib/energy-ui";
import { MODULE_ENERGY, type DeskModuleId } from "@/lib/module-energy";

const modules = [
  {
    id: "scanner",
    label: "Scanner",
    shortLabel: "Scan",
    detail: "Capture, detect, enrich",
    icon: ScanLine,
    accent: "cyan",
  },
  {
    id: "master",
    label: "Master list",
    shortLabel: "List",
    detail: "Saved and extracted rows",
    icon: Database,
    accent: "cyan",
  },
  {
    id: "catalog",
    label: "Catalog",
    shortLabel: "Catalog",
    detail: "Sets, cards, variants",
    icon: BookOpen,
    accent: "amber",
  },
  {
    id: "market",
    label: "Market analytics",
    shortLabel: "Market",
    detail: "Comps, sources, value",
    icon: BarChart3,
    accent: "emerald",
  },
  {
    id: "ai",
    label: "AI insight",
    shortLabel: "AI",
    detail: "Briefs and follow-ups",
    icon: Brain,
    accent: "fuchsia",
  },
  {
    id: "companion",
    label: "PGT Partner",
    shortLabel: "Partner",
    detail: "Hatch, care, and tasks",
    icon: Heart,
    accent: "violet",
  },
] as const;

type ModuleId = (typeof modules)[number]["id"];

const laneOptions: Array<{ id: ScanLaneMode; label: string }> = [
  { id: "all", label: "All" },
  { id: "raw", label: "Raw" },
  { id: "graded", label: "Graded" },
];

function money(value: number | null | undefined) {
  if (value == null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function panelClass(className?: string) {
  return cn("neo-panel rounded-lg", className);
}

function mobileModulePanel(active: ModuleId, id: ModuleId) {
  return cn(active === id ? "block" : "hidden", "lg:block");
}

function NeoButton({
  children,
  className,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition",
        "neo-focus-ring disabled:pointer-events-none disabled:opacity-45",
        variant === "primary" && "neo-btn-primary",
        variant === "secondary" && "neo-btn-secondary",
        variant === "ghost" && "text-muted hover:bg-panel-raised/60 hover:text-primary",
        variant === "danger" &&
          "border border-energy-fire-1/25 bg-energy-fire-1/10 text-energy-fire-3 hover:bg-energy-fire-1/15",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md neo-btn-secondary text-primary transition",
        "neo-focus-ring disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function StatTile({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "electric" | "grass" | "fighting" | "psychic";
  detail?: string;
}) {
  const toneClass = {
    electric: ENERGY_UI.electric.textSoft,
    grass: ENERGY_UI.grass.textSoft,
    fighting: ENERGY_UI.fighting.textSoft,
    psychic: ENERGY_UI.psychic.textSoft,
  }[tone];
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.045] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-semibold tabular-nums", toneClass)}>
        {value}
      </p>
      {detail ? <p className="mt-1 truncate text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}


function BrandMark() {
  return <BrandLogo href={SCANNER_PATH} variant="command" />;
}

function TopCommandBar({
  busy,
  progress,
  slotCount,
  specimenCount,
  activeModule,
  onJump,
  quota,
}: {
  busy: boolean;
  progress: string | null;
  slotCount: number;
  specimenCount: number;
  activeModule: ModuleId;
  onJump: (id: ModuleId) => void;
  quota: AccountQuota | null;
}) {
  const active = modules.find((item) => item.id === activeModule) ?? modules[0];
  return (
    <header className={panelClass("mb-3 p-2.5 lg:sticky lg:top-3 lg:z-20 lg:mb-5 lg:p-3")}>
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <BrandMark />
        <div className="flex items-center gap-1.5">
          <ScanQuotaChip quota={quota} compact />
          <span className="rounded-md border border-border-subtle bg-panel-raised/50 px-2 py-1 font-mono text-[10px] text-accent">
            {specimenCount}
          </span>
          <ThemeControl />
          <AuthControls redirectUrl={SCANNER_PATH} />
        </div>
      </div>

      <div className="hidden gap-3 lg:grid xl:grid-cols-[18rem_minmax(18rem,1fr)_auto] xl:items-center">
        <BrandMark />

        <div className="min-w-0 lg:block">
          <div className="flex h-11 items-center gap-3 rounded-lg border border-white/10 bg-[#070b10] px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
              placeholder="Search cards, sets, certs, players..."
              onFocus={() => onJump("catalog")}
            />
            <span className="hidden rounded border border-white/10 px-2 py-1 font-mono text-[10px] text-slate-500 sm:inline">
              {active.shortLabel}
            </span>
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2 lg:flex xl:justify-end">
          <div className="flex h-10 items-center gap-2 rounded-md border border-border-subtle bg-panel-raised/40 px-3 text-xs text-muted">
            <Activity
              className={cn(
                "h-4 w-4",
                busy ? "animate-pulse text-energy-electric-2" : "text-energy-grass-2",
              )}
            />
            <span className="max-w-[12rem] truncate">{busy ? progress ?? "Pipeline active" : "System ready"}</span>
          </div>
          <div className="hidden h-10 items-center gap-3 rounded-md border border-border-subtle bg-panel-raised/40 px-3 text-xs text-muted md:flex">
            <span className="font-mono text-energy-electric-2">{slotCount}</span> files
            <span className="h-4 w-px bg-border-subtle" />
            <span className="font-mono text-energy-grass-2">{specimenCount}</span> cards
          </div>
          <ScanQuotaChip quota={quota} />
          <ThemeControl />
          <IconButton label="Notifications">
            <Bell className="h-4 w-4" />
          </IconButton>
          <IconButton label="Settings">
            <Settings className="h-4 w-4" />
          </IconButton>
          <AuthControls redirectUrl={SCANNER_PATH} />
        </div>
      </div>
    </header>
  );
}

function ModuleRail({
  activeModule,
  busy,
  onJump,
  companion,
  coreEnergy,
}: {
  activeModule: ModuleId;
  busy: boolean;
  onJump: (id: ModuleId) => void;
  companion: ReturnType<typeof useCompanion>;
  coreEnergy: EnergyType;
}) {
  const coreUi = ENERGY_UI[coreEnergy];

  return (
    <aside className="sticky top-0 z-30 hidden h-screen flex-col border-r border-border-subtle bg-canvas/40 px-4 py-4 backdrop-blur-xl lg:flex">
      <BrandMark />
      <nav className="mt-8 flex shrink-0 flex-col gap-2" aria-label="V2 modules">
        {modules.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          const energy = MODULE_ENERGY[item.id as DeskModuleId];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onJump(item.id)}
              className={cn(
                "group grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border p-2 text-left transition",
                energyNavClasses(energy, active),
              )}
            >
              <span className="grid h-10 w-10 place-items-center rounded-md border border-white/10 bg-[#070b10]">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{item.detail}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 hidden min-h-0 flex-1 overflow-y-auto pr-0.5 lg:block">
        <CompanionDock {...companion} />
      </div>

      <div className="mt-3 shrink-0 pb-1">
        <div className={cn("rounded-lg border neo-inset p-3", coreUi.ring)}>
          <p className="text-[10px] font-semibold uppercase text-faint">Energy core</p>
          <p className={cn("mt-0.5 text-[9px] uppercase", coreUi.textSoft)}>{coreUi.label}</p>
          <div
            className={cn(
              "relative mx-auto mt-4 grid h-28 w-28 place-items-center rounded-full border bg-canvas/80",
              coreUi.ring,
              busy && coreUi.glow,
            )}
          >
            <div
              className={cn(
                "h-14 w-14 rounded-full border bg-canvas",
                busy ? cn("border-current", coreUi.text, coreUi.glow) : "border-border-subtle",
              )}
            />
            <span className={cn("absolute bottom-3 font-mono text-[10px]", coreUi.textSoft)}>
              {busy ? "ACTIVE" : "100%"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function MobileModuleNav({
  activeModule,
  onJump,
}: {
  activeModule: ModuleId;
  onJump: (id: ModuleId) => void;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-canvas/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
      aria-label="Mobile modules"
    >
      <div className="mx-auto grid max-w-xl grid-cols-6 gap-0.5">
        {modules.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          const energy = MODULE_ENERGY[item.id as DeskModuleId];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onJump(item.id)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[9px] font-semibold transition sm:px-2 sm:text-[10px]",
                active ? energyNavClasses(energy, true) : "border-transparent bg-panel-raised/30 text-faint",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.shortLabel}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileScanStatusPill({
  busy,
  progress,
  slotCount,
  specimenCount,
  totals,
}: {
  busy: boolean;
  progress: string | null;
  slotCount: number;
  specimenCount: number;
  totals: { verifiedFmv: number };
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 lg:hidden">
      <div className="max-w-full truncate rounded-full border border-white/10 bg-[#070b10]/92 px-3 py-1.5 font-mono text-[10px] text-slate-300 shadow-lg backdrop-blur-md">
        <span className={busy ? "text-cyan-200" : "text-emerald-200"}>
          {busy ? progress ?? "Scanning" : "Ready"}
        </span>
        <span className="text-slate-600"> / </span>
        <span>{slotCount} files</span>
        <span className="text-slate-600"> / </span>
        <span>{specimenCount} cards</span>
        {totals.verifiedFmv > 0 ? (
          <>
            <span className="text-slate-600"> / </span>
            <span className="text-emerald-200">{money(totals.verifiedFmv)}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function BottomStatusBar({
  busy,
  progress,
  slotCount,
  specimenCount,
  totals,
}: {
  busy: boolean;
  progress: string | null;
  slotCount: number;
  specimenCount: number;
  totals: { count: number; verifiedFmv: number; asking: number };
}) {
  const statusItems = [
    {
      label: "Scanner",
      value: busy ? "Scanning" : "Ready",
      detail: `${slotCount} files / ${specimenCount} cards`,
      icon: ScanLine,
      tone: "text-cyan-200",
    },
    {
      label: "System",
      value: "Optimal",
      detail: progress ?? "Vision queue clear",
      icon: Gauge,
      tone: "text-emerald-200",
    },
    {
      label: "Market",
      value: totals.verifiedFmv > 0 ? "Live" : "Standby",
      detail: money(totals.verifiedFmv),
      icon: CircleDollarSign,
      tone: "text-emerald-200",
    },
    {
      label: "CPU",
      value: busy ? "42%" : "18%",
      detail: "Client pipeline",
      icon: Cpu,
      tone: "text-amber-200",
    },
    {
      label: "Memory",
      value: specimenCount > 0 ? "68%" : "31%",
      detail: "Session state",
      icon: HardDrive,
      tone: "text-fuchsia-200",
    },
    {
      label: "Network",
      value: "Live",
      detail: "API connected",
      icon: Wifi,
      tone: "text-emerald-200",
    },
  ];

  return (
    <div className="sticky bottom-3 z-20 mt-5 hidden lg:block">
      <div className={panelClass("grid gap-2 p-2 md:grid-cols-3 xl:grid-cols-6")}>
        {statusItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex min-w-0 items-center gap-2 rounded-md border border-white/[0.07] bg-[#070b10]/80 px-3 py-2">
              <Icon className={cn("h-4 w-4 shrink-0", item.tone)} />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase text-slate-500">{item.label}</p>
                <p className="truncate font-mono text-xs text-slate-100">
                  {item.value}
                  <span className="ml-2 text-slate-600">{item.detail}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScannerPreview({
  specimen,
  onAdjustCrop,
}: {
  specimen: ScanSpecimen | null;
  onAdjustCrop: () => void;
}) {
  const confidence = specimen ? Math.round(specimen.context.confidence * 100) : 0;
  const catalogConfidence = specimen ? Math.round(specimen.context.catalogConfidence * 100) : 0;
  const hero = specimen ? formatFairMarketValueHero(specimen) : null;
  const slabTag = specimen ? formatGradedSlabTag(specimen.card, specimen.context.lane) : null;
  const asking = specimen ? formatAskingPrice(specimen) : "-";
  const display = specimen ? getReviewQueueCardDisplay(specimen) : null;
  const catalogImageUrl = display?.fromCatalog ? display.imageUrl : null;
  const hasFullSrc = Boolean(specimen?.previewUrl);

  return (
    <div className="relative overflow-hidden rounded-lg border border-cyan-300/16 bg-[#070b10]">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(103,232,249,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.055)_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="relative grid min-h-[14rem] gap-4 p-4 lg:min-h-[22rem] lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-center lg:gap-5 lg:p-5">
        {specimen ? (
          <>
            <div className="mx-auto w-full max-w-[18rem]">
              <div
                className={cn(
                  "relative aspect-[3/4] overflow-hidden rounded-lg border bg-black/70",
                  display?.fromCatalog ? "border-energy-electric-1/35" : "border-white/[0.1]",
                )}
              >
                {catalogImageUrl && display ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={catalogImageUrl} alt={display.imageAlt} className="h-full w-full object-contain p-1.5" />
                ) : (
                  <div className="grid h-full w-full place-items-center p-4 text-center">
                    <div>
                      <ImageIcon className="mx-auto h-9 w-9 text-slate-600" />
                      <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Catalog pending</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-600">
                        Extracted capture is available in Evidence.
                      </p>
                    </div>
                  </div>
                )}
                <span
                  className={cn(
                    "absolute left-2 top-2 rounded border px-2 py-1 text-[10px] font-semibold uppercase",
                    display?.fromCatalog
                      ? "border-energy-electric-1/30 bg-energy-electric-1/12 text-energy-electric-3"
                      : "border-white/10 bg-black/70 text-slate-400",
                  )}
                >
                  {display?.sourceLabel ?? "Catalog"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <VerificationPill status={specimen.context.verificationStatus} />
                {hasFullSrc ? (
                  <IconButton label="Adjust crop" className="h-8 w-8" onClick={onAdjustCrop}>
                    <Maximize2 className="h-4 w-4" />
                  </IconButton>
                ) : null}
              </div>
            </div>
            <div className="min-w-0 rounded-lg border border-white/[0.08] bg-black/20 p-3">
              <p className="text-[10px] font-semibold uppercase text-cyan-200">
                {display?.fromCatalog ? "Active catalog card" : "Active detection"}
              </p>
              <h3 className="mt-1 truncate text-lg font-semibold text-white">{display?.name ?? specimen.card.name}</h3>
              <p className="mt-1 truncate text-xs text-slate-500">
                {display?.subtitle ?? formatSpecimenSubtitle(specimen)}
              </p>
              {slabTag ? (
                <p className="mt-1 truncate font-mono text-[11px] text-amber-200/95">{slabTag}</p>
              ) : display?.meta ? (
                <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{display.meta}</p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-white/[0.08] bg-white/[0.04] p-2">
                  <p className="text-[10px] uppercase text-slate-500">Vision</p>
                  <p className="mt-1 font-mono text-lg text-cyan-100">{confidence}%</p>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-white/[0.04] p-2">
                  <p className="text-[10px] uppercase text-slate-500">Catalog</p>
                  <p className="mt-1 font-mono text-lg text-amber-100">{catalogConfidence}%</p>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-white/[0.04] p-2">
                  <p className="text-[10px] uppercase text-slate-500">Lane</p>
                  <p className="mt-1 font-mono text-sm uppercase text-slate-100">{specimen.context.lane}</p>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-white/[0.04] p-2">
                  <p className="text-[10px] uppercase text-slate-500">Sticker / ask</p>
                  <p className="mt-1 font-mono text-sm text-amber-100">{asking}</p>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-white/[0.04] p-2">
                  <p className="text-[10px] uppercase text-slate-500">FMV</p>
                  <p className="mt-1 font-mono text-sm text-emerald-100">{hero?.amount ?? "-"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onAdjustCrop}
                disabled={!hasFullSrc}
                className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:pointer-events-none disabled:opacity-40"
              >
                <Crosshair className="h-4 w-4" />
                Adjust detection crop
              </button>
            </div>
          </>
        ) : (
          <div className="col-span-full text-center">
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-lg border border-dashed border-cyan-300/30 bg-cyan-300/7 text-cyan-200">
              <div className="relative grid h-16 w-16 place-items-center">
                <span className="absolute inset-0 rounded border border-cyan-300/25" />
                <span className="absolute left-1/2 top-0 h-full w-px bg-cyan-300/20" />
                <span className="absolute left-0 top-1/2 h-px w-full bg-cyan-300/20" />
                <ScanLine className="h-8 w-8" />
              </div>
            </div>
            <p className="mt-4 text-lg font-semibold text-white">No active card</p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-400">
              Upload a capture, run scan, then select a row to inspect the crop, market, catalog, and AI brief.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
function SpecimenRow({
  item,
  index,
  selected,
  busy,
  onSelect,
  onOpenCrop,
  onRescan,
  onRemove,
}: {
  item: ScanSpecimen;
  index: number;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onOpenCrop: () => void;
  onRescan: () => void;
  onRemove: () => void;
}) {
  const hero = formatFairMarketValueHero(item);
  const ready = marketDataReady(item);
  const asking = formatAskingPriceCompact(item);
  const slabTag = formatGradedSlabTag(item.card, item.context.lane);
  const display = getReviewQueueCardDisplay(item);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border p-2.5 text-left transition",
        selected
          ? "border-cyan-300/45 bg-cyan-300/10"
          : "border-white/[0.08] bg-white/[0.035] hover:border-white/16 hover:bg-white/[0.055]",
      )}
    >
      <div
        className={cn(
          "relative h-14 w-11 overflow-hidden rounded-md border bg-[#070b10]",
          display.fromCatalog ? "border-energy-electric-1/30" : "border-white/[0.08]",
        )}
      >
        {display.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display.imageUrl}
            alt={display.imageAlt}
            className={cn(
              "h-full w-full opacity-90",
              display.fromCatalog ? "object-contain p-0.5" : "object-cover",
            )}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-slate-600">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
        <span className="absolute left-1 top-1 rounded bg-black/70 px-1 font-mono text-[9px] text-white">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-semibold text-slate-100">{display.name}</p>
          {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-200" /> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{display.subtitle}</p>
        {slabTag ? (
          <p className="mt-0.5 truncate font-mono text-[10px] text-amber-200/90">{slabTag}</p>
        ) : display.meta ? (
          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{display.meta}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              display.fromCatalog
                ? "border-energy-electric-1/25 bg-energy-electric-1/10 text-energy-electric-3"
                : "border-white/10 bg-white/[0.03] text-slate-400",
            )}
          >
            {display.sourceLabel}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              item.context.verificationStatus === "verified"
                ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                : item.context.verificationStatus === "partial"
                  ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                  : "border-rose-300/25 bg-rose-300/10 text-rose-200",
            )}
          >
            <BadgeCheck className="h-3 w-3" />
            {item.context.verificationStatus}
          </span>
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-slate-400">
            {item.context.lane}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="hidden text-right sm:block">
          <p className="font-mono text-xs text-amber-200/95">{asking}</p>
          <p className="text-[9px] uppercase text-slate-600">Ask</p>
          <p className={cn("mt-1 font-mono text-sm", ready ? "text-emerald-200" : "text-slate-500")}>
            {hero.amount}
          </p>
          <p className="text-[10px] uppercase text-slate-600">FMV</p>
        </div>
        <IconButton
          label="Adjust crop"
          className="h-8 w-8 opacity-80"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCrop();
          }}
          disabled={!item.previewUrl}
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label="Rescan card"
          className="h-8 w-8 opacity-80"
          onClick={(event) => {
            event.stopPropagation();
            onRescan();
          }}
          disabled={!item.previewUrl || busy}
        >
          <RotateCcw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
        </IconButton>
        <IconButton
          label="Remove card"
          className="h-8 w-8 text-rose-200 opacity-80 hover:border-rose-300/30 hover:bg-rose-500/10"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          disabled={busy}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </button>
  );
}

function MasterSessionPanel({
  specimens,
  totals,
}: {
  specimens: ScanSpecimen[];
  totals: { count: number; verifiedFmv: number; asking: number };
}) {
  const verified = specimens.filter((item) => item.context.verificationStatus === "verified").length;
  const marketReady = specimens.filter((item) => marketDataReady(item)).length;

  return (
    <section className={panelClass("p-4")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase text-cyan-200">Master extracted list</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Current session sheet</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            This is the working list before save. Save the session to merge these rows into the persistent master sheet.
          </p>
        </div>
        <Link
          href="/saved"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15"
        >
          <Database className="h-4 w-4" />
          Open saved master
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <StatTile label="Rows" value={String(specimens.length)} tone="electric" detail="Current extraction" />
        <StatTile label="Verified" value={String(verified)} tone="grass" detail="Ready rows" />
        <StatTile label="Market ready" value={String(marketReady)} tone="fighting" detail={money(totals.verifiedFmv)} />
        <StatTile label="Asking" value={money(totals.asking)} tone="psychic" detail="Detected stickers" />
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-white/[0.08]">
        <div className="hidden grid-cols-[minmax(11rem,1.1fr)_minmax(7rem,0.65fr)_minmax(7rem,0.65fr)_4rem_4rem_4.5rem_4.5rem_4rem] gap-2 border-b border-white/[0.08] bg-[#070b10] px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 lg:grid">
          <span>Card</span>
          <span>Set / No.</span>
          <span>Grade / Cert</span>
          <span>Lane</span>
          <span>Status</span>
          <span>Ask</span>
          <span>FMV</span>
          <span>Cat.</span>
        </div>
        <div className="max-h-80 divide-y divide-white/[0.07] overflow-y-auto">
          {specimens.length > 0 ? (
            specimens.map((item) => {
              const hero = formatFairMarketValueHero(item);
              const asking = formatAskingPriceCompact(item);
              const slabTag = formatGradedSlabTag(item.card, item.context.lane);
              return (
                <div
                  key={item.id}
                  className="grid gap-3 bg-white/[0.025] px-3 py-3 text-sm lg:grid-cols-[minmax(11rem,1.1fr)_minmax(7rem,0.65fr)_minmax(7rem,0.65fr)_4rem_4rem_4.5rem_4.5rem_4rem] lg:gap-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{getCardDisplayTitle(item.card)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{formatSpecimenMetaLine(item)}</p>
                  </div>
                  <p className="flex min-w-0 items-center justify-between gap-3 truncate text-slate-400 lg:block">
                    <span className="text-[10px] font-semibold uppercase text-slate-600 lg:hidden">Set</span>
                    {[item.card.set, item.card.number].filter(Boolean).join(" / ") || "-"}
                  </p>
                  <p className="flex min-w-0 items-center justify-between gap-3 truncate font-mono text-xs text-amber-100/95 lg:block">
                    <span className="font-sans text-[10px] font-semibold uppercase text-slate-600 lg:hidden">
                      Grade
                    </span>
                    {slabTag ?? "-"}
                  </p>
                  <p className="flex items-center justify-between gap-3 font-mono text-xs uppercase text-slate-400 lg:block">
                    <span className="font-sans text-[10px] font-semibold uppercase text-slate-600 lg:hidden">Lane</span>
                    {item.context.lane}
                  </p>
                  <p className="flex items-center justify-between gap-3 font-mono text-xs text-slate-400 lg:block">
                    <span className="font-sans text-[10px] font-semibold uppercase text-slate-600 lg:hidden">Status</span>
                    {item.context.verificationStatus}
                  </p>
                  <p className="flex items-center justify-between gap-3 font-mono text-xs text-amber-100 lg:block">
                    <span className="font-sans text-[10px] font-semibold uppercase text-slate-600 lg:hidden">Ask</span>
                    {asking}
                  </p>
                  <p className="flex items-center justify-between gap-3 font-mono text-sm text-emerald-100 lg:block">
                    <span className="font-sans text-[10px] font-semibold uppercase text-slate-600 lg:hidden">FMV</span>
                    {hero.amount}
                  </p>
                  <p className="flex items-center justify-between gap-3 font-mono text-xs text-slate-300 lg:block">
                    <span className="font-sans text-[10px] font-semibold uppercase text-slate-600 lg:hidden">Cat.</span>
                    {pct(item.context.catalogConfidence)}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              Run a scan or use Scan this card from the catalog to populate the current sheet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function UploadPanel({
  slots,
  scanning,
  progress,
  error,
  scanLimit,
  quota,
  onDismissLimit,
  onAddFiles,
  onRemoveSlot,
  onCertMatrix,
}: {
  slots: ScanImageSlot[];
  scanning: boolean;
  progress: string | null;
  error: string | null;
  scanLimit: ScanLimitPayload | null;
  quota: AccountQuota | null;
  onDismissLimit?: () => void;
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveSlot: (id: string) => void;
  onCertMatrix: (raw: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const slotCount = slots.length;

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) onAddFiles(event.dataTransfer.files);
  };

  return (
    <div className={panelClass("p-4")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-cyan-200">Scanner intake</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Capture workspace</h2>
        </div>
        <div className="flex items-center gap-2">
          <ScanQuotaChip quota={quota} compact className="hidden sm:inline-flex" />
          <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 font-mono text-xs text-cyan-100">
            {slotCount} files
          </div>
        </div>
      </div>

      <ScanQuotaTip quota={quota} />

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "mt-4 flex min-h-[10rem] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition",
          dragging
            ? "border-cyan-200 bg-cyan-300/12"
            : "border-cyan-300/24 bg-[#070b10] hover:border-cyan-200/50 hover:bg-cyan-300/8",
        )}
      >
        <UploadCloud className="h-8 w-8 text-cyan-200" />
        <span className="mt-3 text-sm font-semibold text-slate-100">Drop card photos or browse</span>
        <span className="mt-1 text-xs text-slate-500">Binder pages, slabs, raw cards, and multi-card captures</span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) onAddFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>

      {slots.length > 0 ? (
        <div className="mt-4 rounded-lg border border-white/[0.08] bg-[#070b10] p-2">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Loaded captures</p>
            <p className="font-mono text-[10px] text-cyan-100">{slots.length}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {slots.slice(0, 6).map((slot, index) => (
              <div key={slot.id} className="group relative overflow-hidden rounded-md border border-white/10 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slot.previewUrl} alt={`Capture ${index + 1}`} className="aspect-[3/4] w-full object-cover" />
                <div className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[9px] text-white">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <button
                  type="button"
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded bg-black/65 text-white opacity-100 transition hover:bg-rose-500/80 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => onRemoveSlot(slot.id)}
                  aria-label={`Remove capture ${index + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {slots.length > 6 ? (
            <p className="mt-2 text-center text-[11px] text-slate-500">+{slots.length - 6} more queued</p>
          ) : null}
        </div>
      ) : null}

      <label className="mt-4 block">
        <span className="text-[10px] font-semibold uppercase text-slate-500">Cert matrix</span>
        <textarea
          className="mt-2 min-h-[5.5rem] w-full resize-y rounded-md border border-white/10 bg-[#070b10] px-3 py-2 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-700 focus:border-cyan-300/45"
          placeholder={"PSA 12345678\nCGC 87654321"}
          onBlur={(event) => {
            if (event.target.value.trim()) onCertMatrix(event.target.value);
          }}
        />
      </label>

      {progress || scanning ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-cyan-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress ?? "Scanning"}
        </p>
      ) : null}
      {scanLimit ? (
        <ScanLimitBanner
          className="mt-3"
          limit={scanLimit}
          bonusScans={quota?.usage.bonusScans}
          onDismiss={onDismissLimit}
        />
      ) : error ? (
        <p className="mt-3 text-sm text-rose-200">{error}</p>
      ) : null}

      <div className="mt-4 grid gap-2">
        {[
          { label: "Image intake", value: slotCount > 0 ? "Loaded" : "Waiting", icon: ImageIcon },
          { label: "Cert matrix", value: "Optional", icon: FileText },
          { label: "Vision pass", value: scanning ? "Running" : "Ready", icon: Camera },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-white/[0.07] bg-white/[0.035] px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-xs text-slate-400">
                <Icon className="h-3.5 w-3.5 text-cyan-200" />
                {item.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-200">{item.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CatalogPanel({
  specimen,
  busy = false,
  onConfirmCandidate,
  onRejectCandidate,
}: {
  specimen: ScanSpecimen | null;
  busy?: boolean;
  onConfirmCandidate: (candidate: ScanSpecimen["context"]["catalogCandidates"][number]) => void;
  onRejectCandidate: (catalogId: string) => void;
}) {
  const candidates = specimen?.context.catalogCandidates ?? [];
  const best = candidates[0] ?? null;
  const activeCatalogId = specimen?.context.catalogId ?? null;
  return (
    <section id="catalog" className={panelClass("p-3")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-amber-200">Catalog intelligence</p>
          <h2 className="mt-1 text-base font-semibold text-white">Identity match</h2>
        </div>
        <Link
          href={scannerHref("catalog")}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-slate-200 transition hover:border-amber-200/35 hover:bg-amber-300/10"
        >
          <BookOpen className="h-4 w-4" />
          Catalog
        </Link>
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#070b10] p-3">
        <div className="flex items-center gap-2 text-slate-500">
          <Search className="h-4 w-4" />
          <p className="truncate text-sm">
            {specimen
              ? [getCardDisplayTitle(specimen.card), specimen.card.set, specimen.card.number].filter(Boolean).join(" / ")
              : "Select a scanned card to see catalog matches"}
          </p>
        </div>
      </div>

      {specimen ? (
        <div className="mt-3 grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
              <p className="text-[10px] uppercase text-slate-500">Status</p>
              <p className="mt-1 truncate text-xs font-semibold text-amber-100">{specimen.context.catalogIdentityStatus}</p>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
              <p className="text-[10px] uppercase text-slate-500">Confidence</p>
              <p className="mt-1 font-mono text-xs text-cyan-100">{pct(specimen.context.catalogConfidence)}</p>
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
              <p className="text-[10px] uppercase text-slate-500">Options</p>
              <p className="mt-1 font-mono text-xs text-fuchsia-100">{candidates.length}</p>
            </div>
          </div>

          {best ? (
            <div className="space-y-2">
              {candidates.slice(0, 6).map((candidate) => {
                const active = activeCatalogId === candidate.catalogId;
                return (
                  <div
                    key={candidate.catalogId}
                    className={cn(
                      "grid gap-3 rounded-lg border p-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]",
                      active
                        ? "border-emerald-300/25 bg-emerald-300/[0.08]"
                        : "border-amber-300/16 bg-amber-300/[0.06]",
                    )}
                  >
                    <div className="h-14 w-10 overflow-hidden rounded border border-white/10 bg-[#070b10]">
                      {candidate.imageSmallUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={candidate.imageSmallUrl} alt="" className="h-full w-full object-contain" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-100">{candidate.name}</p>
                        {active ? (
                          <span className="rounded border border-emerald-300/25 bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                            User verified
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {[candidate.setName, candidate.cardNumber, candidate.year, candidate.rarity].filter(Boolean).join(" / ") ||
                          "Catalog metadata pending"}
                      </p>
                      {candidate.conflicts.length > 0 ? (
                        <p className="mt-1 truncate text-[10px] text-rose-200/80">{candidate.conflicts[0]}</p>
                      ) : candidate.reasons.length > 0 ? (
                        <p className="mt-1 truncate text-[10px] text-slate-500">{candidate.reasons[0]}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <div className="min-w-10 text-right font-mono text-xs text-amber-100">
                        {Math.round(candidate.confidence * 100)}%
                      </div>
                      <button
                        type="button"
                        disabled={busy || active}
                        onClick={() => onConfirmCandidate(candidate)}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-emerald-300/25 bg-emerald-300/10 px-2 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-300/15 disabled:pointer-events-none disabled:opacity-45"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRejectCandidate(candidate.catalogId)}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-rose-300/20 bg-rose-300/8 px-2 text-[11px] font-semibold text-rose-100 transition hover:bg-rose-300/12 disabled:pointer-events-none disabled:opacity-45"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                );
              })}
              {candidates.length > 6 ? (
                <p className="text-center text-[11px] text-slate-500">
                  Showing top 6 of {candidates.length} catalog candidates.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-5 text-center text-sm text-slate-500">
              Catalog match appears after scan enrichment. Edit the selected record and resync if the identity needs another pass.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-white/[0.1] px-3 py-5 text-center text-sm text-slate-500">
          Select a scanned card to see match status, confidence, and best candidate.
        </p>
      )}
    </section>
  );
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const a = sorted[mid - 1];
  const b = sorted[mid];
  return a == null || b == null ? null : (a + b) / 2;
}

function formatMarketDate(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function marketStats(specimen: ScanSpecimen | null) {
  const evidence = specimen?.context.marketEvidence ?? [];
  const priced = evidence.filter((item) => item.priceUsd != null && Number.isFinite(item.priceUsd));
  const sold = evidence.filter((item) => item.kind === "sold");
  const active = evidence.filter((item) => item.kind === "active");
  const reference = evidence.filter((item) => item.kind === "reference");
  const soldPrices = sold
    .map((item) => item.priceUsd)
    .filter((value): value is number => value != null && Number.isFinite(value));
  const allPrices = priced.map((item) => item.priceUsd).filter((value): value is number => value != null);
  const newest = [...evidence].sort((a, b) => {
    const at = a.observedAt ? new Date(a.observedAt).getTime() : 0;
    const bt = b.observedAt ? new Date(b.observedAt).getTime() : 0;
    return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
  })[0];

  return {
    evidence,
    priced,
    sold,
    active,
    reference,
    allPrices,
    soldMedian: median(soldPrices),
    priceMedian: median(allPrices),
    priceLow: allPrices.length ? Math.min(...allPrices) : null,
    priceHigh: allPrices.length ? Math.max(...allPrices) : null,
    newest,
  };
}

function marketDecision(specimen: ScanSpecimen | null, stats: ReturnType<typeof marketStats>) {
  if (!specimen) {
    return {
      label: "Awaiting card",
      detail: "Select a scanned card to build a market decision.",
      tone: "slate" as const,
    };
  }
  if (specimen.context.verificationStatus === "failed") {
    return {
      label: "Verify first",
      detail: "Identity has conflicts. Resolve catalog fields before pricing.",
      tone: "rose" as const,
    };
  }
  if (stats.sold.length >= 2 && specimen.context.fairValueUsd != null) {
    return {
      label: "Ready to price",
      detail: "Sold comps and fair value are available for a confident decision.",
      tone: "emerald" as const,
    };
  }
  if (stats.active.length > 0 || stats.reference.length > 0) {
    return {
      label: "Price with caution",
      detail: "Market context exists, but sold evidence is thin.",
      tone: "amber" as const,
    };
  }
  return {
    label: "Research needed",
    detail: "Run enrichment or open sources to gather comps.",
    tone: "cyan" as const,
  };
}

function PriceSparkline({ specimen }: { specimen: ScanSpecimen | null }) {
  const points = useMemo(() => {
    const evidence = (specimen?.context.marketEvidence ?? [])
      .filter((item) => item.priceUsd != null && Number.isFinite(item.priceUsd))
      .sort((a, b) => {
        const at = a.observedAt ? new Date(a.observedAt).getTime() : 0;
        const bt = b.observedAt ? new Date(b.observedAt).getTime() : 0;
        return (Number.isNaN(at) ? 0 : at) - (Number.isNaN(bt) ? 0 : bt);
      })
      .slice(-10);
    const prices = evidence.map((item) => item.priceUsd).filter((value): value is number => value != null);
    const low = prices.length ? Math.min(...prices) : 0;
    const high = prices.length ? Math.max(...prices) : 0;
    const spread = Math.max(1, high - low);
    return evidence.map((item, index) => {
      const x = evidence.length <= 1 ? 50 : (index / (evidence.length - 1)) * 100;
      const price = item.priceUsd ?? low;
      const y = 90 - ((price - low) / spread) * 70;
      return {
        x,
        y,
        price,
        kind: item.kind,
        label: formatMarketDate(item.observedAt),
      };
    });
  }, [specimen]);

  const line = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#070b10] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-slate-500">Price movement</p>
          <p className="mt-1 text-xs text-slate-500">Latest priced evidence</p>
        </div>
        <TrendingUp className="h-4 w-4 text-emerald-200" />
      </div>
      <div className="mt-3 h-40 rounded-md border border-white/[0.06] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:32px_32px] p-2">
        {points.length > 1 ? (
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="marketFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(52, 211, 153, 0.34)" />
                <stop offset="100%" stopColor="rgba(52, 211, 153, 0)" />
              </linearGradient>
            </defs>
            <polyline
              points={`0,95 ${line} 100,95`}
              fill="url(#marketFill)"
              stroke="none"
            />
            <polyline points={line} fill="none" stroke="rgb(52 211 153)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            {points.map((point, index) => (
              <circle
                key={`${point.x}-${index}`}
                cx={point.x}
                cy={point.y}
                r="1.9"
                fill={point.kind === "sold" ? "rgb(103 232 249)" : "rgb(251 191 36)"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        ) : (
          <div className="grid h-full place-items-center text-center text-sm text-slate-600">
            Price chart appears once multiple priced comps are loaded.
          </div>
        )}
      </div>
    </div>
  );
}

function MarketPanel({ specimen }: { specimen: ScanSpecimen | null }) {
  const sources = specimen ? summarizeSources(specimen) : [];
  const stats = marketStats(specimen);
  const decision = marketDecision(specimen, stats);
  const toneClass = {
    emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
    amber: "border-amber-300/25 bg-amber-300/10 text-amber-100",
    rose: "border-rose-300/25 bg-rose-300/10 text-rose-100",
    cyan: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
    slate: "border-white/10 bg-white/[0.04] text-slate-200",
  }[decision.tone];

  return (
    <section id="market" className={panelClass("p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-emerald-200">Market analytics</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Value, comps, and sources</h2>
        </div>
        <CircleDollarSign className="h-5 w-5 text-emerald-200" />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <div className={cn("rounded-lg border p-3", toneClass)}>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{decision.label}</p>
              <p className="mt-1 text-xs leading-5 opacity-80">{decision.detail}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Sold comps" value={String(stats.sold.length)} tone="grass" detail={money(stats.soldMedian)} />
          <StatTile label="Active asks" value={String(stats.active.length)} tone="fighting" detail="Live listings" />
          <StatTile label="Sources" value={String(sources.length)} tone="electric" detail={stats.newest ? formatMarketDate(stats.newest.observedAt) : "No date"} />
        </div>
      </div>

      <div className="mt-4">
        {specimen ? (
          <SpecimenMarketSummary specimen={specimen} variant="hero" />
        ) : (
          <div className="rounded-lg border border-dashed border-white/[0.1] px-3 py-8 text-center text-sm text-slate-500">
            Select a card to load fair value, sold comps, active listings, and source links.
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <PriceSparkline specimen={specimen} />
        <div className="rounded-lg border border-white/[0.08] bg-[#070b10] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-500">Source health</p>
              <p className="mt-1 text-xs text-slate-500">Sold, active, and reference coverage</p>
            </div>
            <SourceChips sources={sources} maxVisible={4} className="justify-end" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Sold", value: stats.sold.length, tone: "text-cyan-100" },
              { label: "Active", value: stats.active.length, tone: "text-amber-100" },
              { label: "Reference", value: stats.reference.length, tone: "text-fuchsia-100" },
            ].map((item) => (
              <div key={item.label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
                <p className="text-[10px] uppercase text-slate-500">{item.label}</p>
                <p className={cn("mt-1 font-mono text-lg", item.tone)}>{item.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
            <p className="text-[10px] uppercase text-slate-500">Observed range</p>
            <p className="mt-1 font-mono text-sm text-slate-100">
              {stats.priceLow != null && stats.priceHigh != null
                ? `${money(stats.priceLow)} - ${money(stats.priceHigh)}`
                : "No priced comps"}
            </p>
          </div>
          {specimen?.context.marketSourceLinks[0]?.url ? (
            <a
              href={specimen.context.marketSourceLinks[0].url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-emerald-300/20 bg-emerald-300/10 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-300/15"
            >
              Open source hub
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {specimen ? (
          <MarketEvidenceTable
            items={specimen.context.marketEvidence}
            hubLinks={specimen.context.marketSourceLinks}
            card={specimen.card}
            maxRows={5}
          />
        ) : null}
      </div>
    </section>
  );
}

function CompanionMobilePanel({
  companion,
}: {
  companion: ReturnType<typeof useCompanion>;
}) {
  return (
    <div className={panelClass("min-h-[min(70vh,720px)] p-4")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-energy-fairy-2">PGT Partner</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Your companion</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Hatch a partner, keep stats up, and complete daily and weekly tasks while you scan.
          </p>
        </div>
        <Heart className="h-6 w-6 shrink-0 text-energy-fairy-2" />
      </div>
      <CompanionPanel layout="mobile" {...companion} />
    </div>
  );
}

function AIInsightPanel({ specimen }: { specimen: ScanSpecimen | null }) {
  return (
    <section id="ai" className={panelClass("min-h-0 p-3 lg:min-h-[34rem] lg:p-4")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase text-fuchsia-200">AI insight</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Research brief</h2>
        </div>
        <WandSparkles className="h-5 w-5 text-fuchsia-200" />
      </div>
      <div className="neo-embedded">
        <InsightCanvas specimen={specimen} />
      </div>
    </section>
  );
}

function FullCatalogPanel() {
  return (
    <section id="catalog-full" className={panelClass("overflow-hidden p-4")}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase text-amber-200">Full Pokedex</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Sets, cards, variants, and market reference</h2>
          <p className="mt-1 hidden max-w-3xl text-sm leading-6 text-slate-500 lg:block">
            This is the same catalog browser used by the current app, mounted inside the redesign so accuracy,
            filters, variant artwork, market panels, and scan handoff stay aligned.
          </p>
        </div>
        <Link
          href={scannerHref("catalog")}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.055] px-3 text-sm font-semibold text-slate-100 transition hover:border-amber-200/35 hover:bg-amber-300/10"
        >
          <BookOpen className="h-4 w-4" />
          Open classic catalog
        </Link>
      </div>
      <div className="neo-embedded rounded-lg border border-white/[0.08] bg-[#070b10]/70 p-3">
        <PokedexBrowser scanTargetPath={SCANNER_PATH} />
      </div>
    </section>
  );
}

function ActionToolbar({
  laneMode,
  onLaneModeChange,
  busy,
  saving,
  slotCount,
  specimenCount,
  scanBlocked,
  onScan,
  onSave,
  onExportCsv,
  onExportJson,
  onClear,
  saveStatus,
}: {
  laneMode: ScanLaneMode;
  onLaneModeChange: (mode: ScanLaneMode) => void;
  busy: boolean;
  saving: boolean;
  slotCount: number;
  specimenCount: number;
  scanBlocked?: boolean;
  onScan: () => void;
  onSave: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onClear: () => void;
  saveStatus: string | null;
}) {
  return (
    <div className={panelClass("mb-3 p-2.5 lg:mb-5 lg:p-3")}>
      <div className="flex flex-col gap-2 lg:gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="hidden min-w-0 lg:block">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Session controls</p>
          <p className="mt-1 truncate text-sm text-slate-300">
            Run scan, save the session, export data, or switch raw/graded detection lanes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-white/10 bg-[#070b10] p-1">
            {laneOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onLaneModeChange(option.id)}
                className={cn(
                  "h-8 rounded px-3 text-xs font-semibold transition",
                  laneMode === option.id
                    ? "bg-cyan-300 text-[#041016]"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <NeoButton
            variant="primary"
            onClick={onScan}
            disabled={busy || slotCount === 0 || scanBlocked}
            title={scanBlocked ? "Scan limit reached â€” upgrade or buy scans on Usage" : undefined}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
            {scanBlocked ? "Limit reached" : "Start scan"}
          </NeoButton>
          <NeoButton onClick={onSave} disabled={saving || specimenCount === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </NeoButton>
          <IconButton label="Export CSV" onClick={onExportCsv} disabled={specimenCount === 0}>
            <Download className="h-4 w-4" />
          </IconButton>
          <IconButton label="Export JSON" onClick={onExportJson} disabled={specimenCount === 0}>
            <FileJson className="h-4 w-4" />
          </IconButton>
          <IconButton label="Clear session" onClick={onClear} disabled={busy && specimenCount === 0}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
      {saveStatus ? <p className="mt-3 text-sm text-slate-400">{saveStatus}</p> : null}
    </div>
  );
}

function CommandCenterInner() {
  const session = useScanSession();
  const scanQuota = useScanQuota();
  const companion = useCompanion();
  const { primary: themeEnergy } = useActiveThemeEnergy();
  const searchParams = useSearchParams();
  const viewModule = moduleFromViewParam(searchParams.get("view"));
  const [activeModule, setActiveModule] = useState<ModuleId>(() => viewModule ?? "scanner");
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const selected = session.selected;
  const busy = session.scanning || session.enriching;
  const scanBlocked =
    scanQuota.atDailyLimit ||
    scanQuota.atMonthlyLimit ||
    Boolean(session.scanLimit);

  const refreshScanQuota = scanQuota.refresh;
  useEffect(() => {
    if (!busy && !session.scanLimit) void refreshScanQuota();
  }, [busy, session.scanLimit, refreshScanQuota]);
  const selectedBusy =
    selected != null &&
    (session.rescanningId === selected.id || session.enrichingSpecimenId === selected.id);
  const verifiedCount = useMemo(
    () => session.specimens.filter((item) => item.context.verificationStatus === "verified").length,
    [session.specimens],
  );
  const marketReadyCount = useMemo(
    () => session.specimens.filter((item) => marketDataReady(item)).length,
    [session.specimens],
  );

  const cropTarget = useMemo(
    () => session.specimens.find((item) => item.id === cropTargetId) ?? null,
    [cropTargetId, session.specimens],
  );

  const handleSaveSession = useCallback(async () => {
    if (session.specimens.length === 0 || saving) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const response = await fetch("/api/saved/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Command center scan ${new Date().toLocaleString()}`,
          specimens: session.specimens.map((item) => ({
            card: item.card,
            context: item.context,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        savedCount?: number;
      };
      if (!response.ok) throw new Error(payload.error ?? "Unable to save scan session");
      setSaveStatus(`Saved ${payload.savedCount ?? session.specimens.length} card(s).`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Unable to save scan session");
    } finally {
      setSaving(false);
    }
  }, [saving, session.specimens]);

  const openCropForSelected = useCallback(() => {
    if (session.selectedId) setCropTargetId(session.selectedId);
  }, [session.selectedId]);

  useEffect(() => {
    const next = moduleFromViewParam(searchParams.get("view"));
    if (next) setActiveModule(next);
  }, [searchParams]);

  const coreEnergy: EnergyType =
    selected && activeModule === "scanner"
      ? confidenceToEnergy(selected.context.confidence)
      : themeEnergy;

  const jumpToModule = useCallback((id: ModuleId) => {
    setActiveModule(id);
    const isMobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
    if (isMobile) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const targetId = id === "catalog" ? "catalog-full" : id;
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-primary">
      <div className="pointer-events-none fixed inset-0 neo-shell-grid" />
      <div className="pointer-events-none fixed inset-0 neo-shell-aurora" />

      <CatalogPrefillBootstrap session={session} onPrefillComplete={() => setActiveModule("scanner")} />

      {cropTarget?.previewUrl ? (
        <EvidenceCropDialog
          open={Boolean(cropTargetId)}
          onOpenChange={(open) => {
            if (!open) setCropTargetId(null);
          }}
          imageSrc={cropTarget.previewUrl}
          userCenter={cropTarget.userEvidenceCropCenter}
          userRadiusMultiplier={cropTarget.userEvidenceCropRadiusMultiplier}
          autoCenter={cropTarget.evidenceCropLocation}
          gradedSlab={cropTarget.context.lane === "graded"}
          rescanning={session.rescanningId === cropTargetId}
          onApply={(crop) => {
            if (cropTargetId) session.setUserEvidenceCrop(cropTargetId, crop);
          }}
          onResyncWithCrop={(crop) => {
            if (!cropTargetId) return;
            void session.rescanSpecimen(cropTargetId, crop);
          }}
        />
      ) : null}

      <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <ModuleRail
          activeModule={activeModule}
          busy={busy}
          onJump={jumpToModule}
          companion={companion}
          coreEnergy={coreEnergy}
        />

        <main className="min-w-0 px-3 py-3 pb-28 sm:px-6 sm:py-4 lg:px-8 lg:pb-8 xl:px-10">
          <TopCommandBar
            busy={busy}
            progress={session.progress}
            slotCount={session.slots.length}
            specimenCount={session.specimens.length}
            activeModule={activeModule}
            onJump={jumpToModule}
            quota={scanQuota.quota}
          />

          <div className={mobileModulePanel(activeModule, "scanner")}>
            <ActionToolbar
              laneMode={session.laneMode}
              onLaneModeChange={session.setLaneMode}
              busy={busy}
              saving={saving}
              slotCount={session.slots.length}
              specimenCount={session.specimens.length}
              scanBlocked={scanBlocked}
              onScan={() => void session.runScan()}
              onSave={() => void handleSaveSession()}
              onExportCsv={() => downloadSpecimensCsv(session.specimens)}
              onExportJson={() => downloadSpecimensJson(session.specimens)}
              onClear={session.clearSession}
              saveStatus={saveStatus}
            />
          </div>

          <section className="mb-5 hidden gap-3 sm:grid-cols-2 lg:grid xl:grid-cols-4">
            <StatTile label="Cards extracted" value={String(session.totals.count)} tone="electric" detail="Live session count" />
            <StatTile label="Verified FMV" value={money(session.totals.verifiedFmv)} tone="grass" detail="Enriched market value" />
            <StatTile label="Asking total" value={money(session.totals.asking)} tone="fighting" detail="Sticker or detected ask" />
            <StatTile label="System" value={busy ? "Scanning" : "Ready"} tone="psychic" detail={session.progress ?? "Waiting for capture"} />
          </section>

          <div className={mobileModulePanel(activeModule, "scanner")}>
            <section id="scanner" className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)_24rem]">
              <UploadPanel
                slots={session.slots}
                scanning={session.scanning}
                progress={session.progress}
                error={session.error}
                scanLimit={session.scanLimit}
                quota={scanQuota.quota}
                onDismissLimit={session.clearScanLimit}
                onAddFiles={(files) => void session.addFiles(files)}
                onRemoveSlot={session.removeSlot}
                onCertMatrix={session.ingestCertMatrix}
              />

              <div className={panelClass("min-w-0 p-4")}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-cyan-200">Live scanner</p>
                    <h1 className="mt-1 text-2xl font-bold text-white">Vision desk</h1>
                  </div>
                  <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400 sm:flex">
                    <Activity className="h-4 w-4 text-emerald-200" />
                    {busy ? session.progress ?? "Pipeline active" : "Ready"}
                  </div>
                </div>

                <ScannerPreview specimen={selected} onAdjustCrop={openCropForSelected} />

                <ScannerWorkflowPanel
                  busy={busy}
                  progress={session.progress}
                  slotCount={session.slots.length}
                  specimenCount={session.specimens.length}
                  companionState={companion.state}
                  companionBusy={companion.busy}
                  onBattleReward={
                    companion.state?.hatched && !companion.state.actionCooldowns.battle
                      ? () => void companion.runAction("battle")
                      : undefined
                  }
                />
              </div>

              <div className={panelClass("min-w-0 p-4")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Extracted cards</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">Review queue</h2>
                  </div>
                  <Layers3 className="h-5 w-5 text-slate-400" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
                    <p className="text-[10px] uppercase text-slate-500">Rows</p>
                    <p className="mt-1 font-mono text-lg text-cyan-100">{session.specimens.length}</p>
                  </div>
                  <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
                    <p className="text-[10px] uppercase text-slate-500">Verified</p>
                    <p className="mt-1 font-mono text-lg text-emerald-100">{verifiedCount}</p>
                  </div>
                  <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-2">
                    <p className="text-[10px] uppercase text-slate-500">Market</p>
                    <p className="mt-1 font-mono text-lg text-amber-100">{marketReadyCount}</p>
                  </div>
                </div>
                {selected ? (
                  <div className="mt-3 rounded-lg border border-cyan-300/16 bg-cyan-300/[0.06] p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-cyan-100">
                      <Eye className="h-3.5 w-3.5" />
                      In review
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-200">{getCardDisplayTitle(selected.card)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {[selected.card.set, selected.card.number, selected.card.rarity].filter(Boolean).join(" / ") ||
                        "No catalog fields yet"}
                    </p>
                  </div>
                ) : null}
                <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1 lg:max-h-[34rem]">
                  {session.specimens.map((item, index) => (
                    <SpecimenRow
                      key={item.id}
                      item={item}
                      index={index}
                      selected={session.selectedId === item.id}
                      busy={session.rescanningId === item.id || session.enrichingSpecimenId === item.id}
                      onSelect={() => session.setSelectedId(item.id)}
                      onOpenCrop={() => {
                        session.setSelectedId(item.id);
                        setCropTargetId(item.id);
                      }}
                      onRescan={() => void session.rescanSpecimen(item.id)}
                      onRemove={() => {
                        session.removeSpecimen(item.id);
                        if (cropTargetId === item.id) setCropTargetId(null);
                      }}
                    />
                  ))}
                  {session.specimens.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-10 text-center text-sm text-slate-500">
                      Scanned cards will appear here with identity, value, and review controls.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>

          <section id="master" className={cn("mt-5", mobileModulePanel(activeModule, "master"))}>
            <MasterSessionPanel specimens={session.specimens} totals={session.totals} />
          </section>

          <section className="mt-5 grid gap-5 lg:mt-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="grid min-w-0 gap-5">
              <div className={mobileModulePanel(activeModule, "catalog")}>
                <CatalogPanel
                  specimen={selected}
                  busy={Boolean(selectedBusy)}
                  onConfirmCandidate={(candidate) => {
                    if (selected) session.confirmCatalogCandidate(selected.id, candidate);
                  }}
                  onRejectCandidate={(catalogId) => {
                    if (selected) session.rejectCatalogCandidate(selected.id, catalogId);
                  }}
                />
              </div>
              <div className={mobileModulePanel(activeModule, "market")}>
                <MarketPanel specimen={selected} />
              </div>
            </div>

            <div className={cn("grid min-w-0 gap-5", mobileModulePanel(activeModule, "scanner"))}>
              <section className={panelClass("p-4")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Selected record</p>
                    <h2 className="mt-1 text-lg font-semibold text-white">Edit and verify</h2>
                  </div>
                  {selected ? <VerificationPill status={selected.context.verificationStatus} /> : null}
                </div>
                <div className="mt-4">
                  {selected ? (
                    <SpecimenEditFields
                      item={selected}
                      rowBusy={Boolean(selectedBusy)}
                      onUpdate={(patch) => session.updateSpecimen(selected.id, patch)}
                      onCommitEdit={() => void session.flushManualEnrich(selected.id)}
                      onAdjustCrop={() => setCropTargetId(selected.id)}
                      onRescan={() => void session.rescanSpecimen(selected.id)}
                      onRemove={() => {
                        session.removeSpecimen(selected.id);
                        if (cropTargetId === selected.id) setCropTargetId(null);
                      }}
                    />
                  ) : (
                    <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-8 text-center text-sm text-slate-500">
                      Select a card row to edit extraction fields and trigger manual enrichment.
                    </p>
                  )}
                </div>
              </section>

              <div className="neo-embedded">
                <EvidenceRail specimen={selected} onRequestAdjustCrop={openCropForSelected} />
              </div>
            </div>
          </section>

          <section className={cn("mt-5", mobileModulePanel(activeModule, "ai"))}>
            <AIInsightPanel specimen={selected} />
          </section>

          <section
            id="companion"
            className={cn("mt-5", mobileModulePanel(activeModule, "companion"))}
          >
            <CompanionMobilePanel companion={companion} />
          </section>

          <section className={cn("mt-5", mobileModulePanel(activeModule, "catalog"))}>
            <FullCatalogPanel />
          </section>

          <BottomStatusBar
            busy={busy}
            progress={session.progress}
            slotCount={session.slots.length}
            specimenCount={session.specimens.length}
            totals={session.totals}
          />

          <footer className="hidden py-8 text-center text-xs uppercase text-slate-600 lg:block">
            <span>Scan</span>
            <ChevronRight className="mx-2 inline h-3 w-3" />
            <span>Analyze</span>
            <ChevronRight className="mx-2 inline h-3 w-3" />
            <span>Decide</span>
          </footer>
        </main>
      </div>

      <MobileScanStatusPill
        busy={busy}
        progress={session.progress}
        slotCount={session.slots.length}
        specimenCount={session.specimens.length}
        totals={session.totals}
      />
      <MobileModuleNav activeModule={activeModule} onJump={jumpToModule} />

      <style jsx global>{`
        .neo-embedded .panel-chrome,
        .neo-embedded .desk-surface-raised {
          border-radius: 0.5rem;
          border-color: rgba(255, 255, 255, 0.09);
          background: rgba(7, 11, 16, 0.92);
          box-shadow: none;
        }

        .neo-embedded .gradient-border::before,
        .neo-embedded .gradient-border::after {
          display: none;
        }
      `}</style>
    </div>
  );
}

export function CollectorCommandCenter() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#05080c] text-slate-300">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />
            Loading command center
          </div>
        </div>
      }
    >
      <CommandCenterInner />
    </Suspense>
  );
}

