"use client";

import Image from "next/image";
import { BadgeCheck, DollarSign, Layers } from "lucide-react";
import { CatalogCardThumb } from "@/components/scan-panels/catalog-card-thumb";
import { CardMatchResult } from "@/components/scanner-chat/card-match-result";
import {
  ONBOARDING_BINDER_IMAGES,
  ONBOARDING_DEMO_CARDS,
  ONBOARDING_DEMO_SUMMARY,
  ONBOARDING_MARKET_TIERS,
  ONBOARDING_SOLD_ROWS,
} from "@/lib/scanner-chat/liquid-scan-onboarding-data";
import { cn } from "@/lib/cn";

function TourImageFrame({
  src,
  alt,
  badge,
  className,
  imageClassName,
}: {
  src: string;
  alt: string;
  badge?: string;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 ring-1 ring-white/5",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
        className={cn("object-cover", imageClassName)}
      />
      {badge ? (
        <span className="absolute bottom-2 left-2 rounded-md border border-cyan-400/30 bg-slate-950/85 px-2 py-0.5 text-[10px] font-medium text-cyan-200 backdrop-blur-sm">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function TourChatBubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3 py-2 text-[11px] leading-snug",
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

/** Step 1 — real binder/slab photos (same assets as the live empty state). */
export function TourUploadPreview() {
  return (
    <div className="space-y-2.5">
      <TourChatBubble role="user">{ONBOARDING_BINDER_IMAGES.binderPage.label}</TourChatBubble>
      <TourImageFrame
        src={ONBOARDING_BINDER_IMAGES.binderPage.src}
        alt={ONBOARDING_BINDER_IMAGES.binderPage.alt}
        badge="Sample capture"
        className="h-36 w-full md:h-[min(42vh,14rem)]"
        imageClassName="object-[center_42%]"
      />
      <div className="grid grid-cols-2 gap-2">
        <TourImageFrame
          src={ONBOARDING_BINDER_IMAGES.binderPage.src}
          alt=""
          className="h-16 md:h-20"
          imageClassName="object-[20%_30%] scale-125"
        />
        <TourImageFrame
          src={ONBOARDING_BINDER_IMAGES.gradedSlabs.src}
          alt={ONBOARDING_BINDER_IMAGES.gradedSlabs.alt}
          badge="Slabs"
          className="h-16 md:h-20"
        />
      </div>
    </div>
  );
}

/** Step 2 — live-style detected card rows from a real scan shape. */
export function TourDetectPreview() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-emerald-400" aria-hidden />
          <p className="text-[11px] font-medium text-slate-100">
            Scan complete · {ONBOARDING_DEMO_SUMMARY.totalDetected} cards
          </p>
        </div>
        <p className="text-[11px] font-semibold tabular-nums text-emerald-400">
          ${ONBOARDING_DEMO_SUMMARY.estimatedTotal.toLocaleString()} est.
        </p>
      </div>
      <div className="max-h-[220px] space-y-2 overflow-hidden md:max-h-[min(32vh,280px)]">
        {ONBOARDING_DEMO_CARDS.map((card, index) => (
          <div key={card.id} className="pointer-events-none scale-[0.98] origin-top">
            <CardMatchResult card={card} index={index} stackPricing />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Step 3 — catalog + PSA registry line (production panels). */
export function TourCatalogPreview() {
  const hero = ONBOARDING_DEMO_CARDS[0];
  if (!hero.extractedCard) return null;
  return (
    <div className="space-y-2.5">
      <div className="flex gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5">
        <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
          <CatalogCardThumb
            specimenId={hero.specimenId}
            card={hero.extractedCard}
            catalogImageUrl={hero.catalogImageUrl}
            className="h-full w-full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400/90">
            Catalog match
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-100">{hero.name}</p>
          <p className="text-[11px] text-slate-400">
            {hero.setName} {hero.setNumber} · {hero.year}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            PSA #{hero.graded?.cert} verified · pop on file
          </p>
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">
        Same identity powers FMV, exports, and hub links — no re-typing set or cert.
      </p>
    </div>
  );
}

/** Step 4 — FMV hero + grade ladder + recent solds. */
export function TourMarketPreview() {
  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5">
        <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400/90">
          <DollarSign className="h-3 w-3" aria-hidden />
          Fair market value · PSA 9
        </p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-emerald-300">$142</p>
        <p className="text-[10px] text-slate-500">3 eBay sold comps · last 60 days</p>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {ONBOARDING_MARKET_TIERS.map((tier) => (
          <div
            key={tier.label}
            className={cn(
              "rounded-lg px-2 py-1.5 text-center ring-1",
              tier.highlight
                ? "bg-emerald-500/12 ring-emerald-400/30"
                : "sc-glass ring-white/8",
            )}
          >
            <p className="text-[9px] uppercase tracking-wide text-slate-500">{tier.label}</p>
            <p className="text-[11px] font-semibold tabular-nums text-slate-100">{tier.value}</p>
          </div>
        ))}
      </div>
      <ul className="space-y-1">
        {ONBOARDING_SOLD_ROWS.map((row) => (
          <li
            key={row.title}
            className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 text-[10px]"
          >
            <span className="min-w-0 truncate text-slate-400">{row.title}</span>
            <span className="shrink-0 tabular-nums text-slate-200">
              {row.price}
              <span className="ml-1 text-slate-600">{row.when}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Step 5 — Liquid Ask on the same session data. */
export function TourAskPreview() {
  return (
    <div className="space-y-2">
      <TourChatBubble role="user">What did PSA 10 Raichu Fossil sell for last 60 days?</TourChatBubble>
      <TourChatBubble role="assistant">
        Last 3 sold comps average <span className="font-semibold text-emerald-400">$372</span>.
        Tap any row to open eBay sold search or export the full session to CSV.
      </TourChatBubble>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {["eBay sold", "Card Ladder", "Export CSV"].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
