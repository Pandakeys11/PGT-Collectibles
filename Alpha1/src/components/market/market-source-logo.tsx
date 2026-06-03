"use client";

import Image from "next/image";
import { Activity, Zap } from "lucide-react";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/cn";
import { normalizeMarketSource, sourceLabel, type MarketSourceId } from "@/lib/market/sources";

export type MarketSourceLogoVariant = "default" | "compact";

function effectiveLogoLabel(label: string, sourceId?: MarketSourceId | null): string {
  const trimmed = label.trim();
  if (!sourceId) return trimmed;
  const lower = trimmed.toLowerCase();
  const lane =
    /\bsold\b/.test(lower) || lower.endsWith(" sold")
      ? " sold"
      : /\blisted\b/.test(lower) || /\bactive\b/.test(lower) || lower.endsWith(" listed")
        ? " listed"
        : "";
  return `${sourceLabel(sourceId)}${lane}`;
}

function laneChip(text: string) {
  return (
    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-muted">
      {text}
    </span>
  );
}

/** Brand-accurate typographic marks (PGTVision parity) — not generic abbreviations. */
export function MarketSourceLogo({
  label,
  sourceId,
  variant = "default",
  hideLaneChips = false,
  className,
}: {
  label: string;
  sourceId?: MarketSourceId | null;
  variant?: MarketSourceLogoVariant;
  /** Suppress Sold / Listed / Graded suffix chips parsed from the label. */
  hideLaneChips?: boolean;
  className?: string;
}) {
  const resolved =
    sourceId ?? normalizeMarketSource(label) ?? undefined;
  const display = effectiveLogoLabel(label, resolved ?? null);
  const norm = display.toUpperCase();
  const showLane = !hideLaneChips && variant === "default";

  if (variant === "compact") {
    return (
      <span className={cn("inline-flex items-center", className)} aria-label={display}>
        <MarketSourceLogoCompact label={display} sourceId={resolved} />
      </span>
    );
  }

  if (norm.includes("LIQUID VAULT") || norm.includes("FMV") || norm.includes("PGT")) {
    return (
      <div
        className={cn("flex items-center gap-1.5 font-black uppercase tracking-widest text-primary text-[10px]", className)}
      >
        <Image src={BRAND.logoIcon} alt="" width={14} height={14} className="object-contain" />
        <span>Liquid Vault</span>
      </div>
    );
  }

  if (norm.includes("PRICECHARTING") || norm === "PC") {
    return (
      <div className={cn("flex items-center font-black tracking-tight text-primary text-xs", className)}>
        <span className="text-[#4CAF50]">Price</span>Charting
      </div>
    );
  }

  if (norm.includes("EBAY")) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        <span
          className="font-bold text-[13px] tracking-tighter"
          style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
        >
          <span className="text-[#E53238]">e</span>
          <span className="text-[#0064D2]">b</span>
          <span className="text-[#F5AF02]">a</span>
          <span className="text-[#86B817]">y</span>
        </span>
        {showLane && norm.includes("SOLD") ? laneChip("Sold") : null}
        {showLane && norm.includes("LISTED") ? laneChip("Listed") : null}
        {showLane && norm.includes("GRADED") ? laneChip("Graded") : null}
      </div>
    );
  }

  if (norm.includes("CARDLADDER") || norm.includes("CARD LADDER")) {
    return (
      <div className={cn("flex items-center font-black text-[11px] tracking-tight text-primary", className)}>
        <Activity size={11} className="mr-1 text-[#3b82f6]" aria-hidden />
        Card<span className="text-[#3b82f6]">Ladder</span>
      </div>
    );
  }

  if (norm.includes("TCGPLAYER") || norm.includes("TCG PLAYER")) {
    return (
      <div className={cn("flex items-center font-black text-xs tracking-tighter text-[#188EEE]", className)}>
        TCG<span className="font-medium text-primary">player</span>
      </div>
    );
  }

  if (norm.includes("CARDMARKET") || norm.includes("CARD MARKET")) {
    return (
      <div className={cn("flex items-center font-bold text-[11px] tracking-tight text-primary", className)}>
        <span className="text-[#156FB6]">Card</span>market
      </div>
    );
  }

  if (norm.includes("ALT") && !norm.includes("FANATICS")) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-sm bg-white px-1.5 py-0.5 font-black text-[9px] text-black",
          className,
        )}
      >
        ALT
      </div>
    );
  }

  if (norm.includes("GOLDIN")) {
    return (
      <div className={cn("font-black text-[11px] tracking-tight text-[#C9A227]", className)}>Goldin</div>
    );
  }

  if (norm.includes("FANATICS")) {
    return (
      <div className={cn("font-bold text-[10px] tracking-tight", className)}>
        <span className="text-[#0066CC]">Fanatics</span>{" "}
        <span className="font-medium text-primary/90">Collect</span>
      </div>
    );
  }

  if (norm.includes("130") && norm.includes("POINT")) {
    return (
      <div className={cn("flex flex-wrap items-center gap-1.5 font-black text-[11px] tracking-tight", className)}>
        <span className="text-[#E85D04]">130</span>
        <span className="text-primary">Point</span>
        {showLane && norm.includes("SOLD") ? laneChip("Sold") : null}
      </div>
    );
  }

  if (norm.includes("POKETRACE")) {
    return (
      <div className={cn("flex items-center gap-1.5 font-bold text-[11px] tracking-tight text-primary", className)}>
        <Zap size={12} className="text-[#A78BFA] fill-[#A78BFA]" aria-hidden />
        <span>
          Poke<span className="text-[#A78BFA]">Trace</span>
        </span>
      </div>
    );
  }

  if (norm.includes("PWCC")) {
    return (
      <div className={cn("font-black text-[10px] uppercase tracking-wide text-violet-300", className)}>PWCC</div>
    );
  }

  return (
    <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] text-muted", className)}>
      {display}
    </span>
  );
}

/** Tight badge for comp rows and tables — still uses brand colors where possible. */
export function MarketSourceLogoCompact({
  label,
  sourceId,
  className,
}: {
  label: string;
  sourceId?: MarketSourceId;
  className?: string;
}) {
  const resolved = sourceId ?? normalizeMarketSource(label) ?? undefined;
  const display = effectiveLogoLabel(label, resolved ?? null);
  const norm = display.toUpperCase();

  if (norm.includes("PRICECHARTING") || norm === "PC") {
    return (
      <span className={cn("font-black tracking-tight text-[10px]", className)}>
        <span className="text-[#4CAF50]">Price</span>
        <span className="text-primary/90">Chart</span>
      </span>
    );
  }

  if (norm.includes("EBAY")) {
    return (
      <span
        className={cn("font-bold text-[11px] tracking-tighter", className)}
        style={{ fontFamily: "Helvetica, Arial, sans-serif" }}
      >
        <span className="text-[#E53238]">e</span>
        <span className="text-[#0064D2]">b</span>
        <span className="text-[#F5AF02]">a</span>
        <span className="text-[#86B817]">y</span>
      </span>
    );
  }

  if (norm.includes("TCGPLAYER")) {
    return (
      <span className={cn("font-black text-[10px] text-[#188EEE]", className)}>
        TCG<span className="font-medium text-primary/80">p</span>
      </span>
    );
  }

  if (norm.includes("CARDMARKET")) {
    return (
      <span className={cn("font-bold text-[10px]", className)}>
        <span className="text-[#156FB6]">C</span>
        <span className="text-primary/85">mkt</span>
      </span>
    );
  }

  if (norm.includes("CARDLADDER")) {
    return (
      <span className={cn("font-black text-[10px]", className)}>
        <span className="text-[#3b82f6]">CL</span>
      </span>
    );
  }

  if (norm.includes("ALT")) {
    return (
      <span
        className={cn(
          "inline-flex rounded-sm bg-white px-1 py-px font-black text-[8px] text-black",
          className,
        )}
      >
        ALT
      </span>
    );
  }

  if (norm.includes("GOLDIN")) {
    return <span className={cn("font-black text-[10px] text-[#C9A227]", className)}>GD</span>;
  }

  if (norm.includes("FANATICS")) {
    return <span className={cn("font-black text-[9px] text-[#0066CC]", className)}>FC</span>;
  }

  if (norm.includes("130") && norm.includes("POINT")) {
    return (
      <span className={cn("font-black text-[10px] tracking-tight", className)}>
        <span className="text-[#E85D04]">130</span>
        <span className="text-primary/90">Pt</span>
      </span>
    );
  }

  if (norm.includes("POKETRACE")) {
    return <span className={cn("font-black text-[10px] text-[#A78BFA]", className)}>PT</span>;
  }

  return (
    <span className={cn("font-black text-[9px] uppercase text-muted", className)}>
      {display.slice(0, 2)}
    </span>
  );
}
