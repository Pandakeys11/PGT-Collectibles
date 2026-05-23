"use client";

import {
  Award,
  ExternalLink,
  Info,
  LineChart,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { LiquidAskDataCoverage, LiquidAskResearch } from "@/lib/scanner-chat/liquid-ask-types";
import { partitionComps } from "@/lib/scanner-chat/prioritize-comps";
import { LiquidAskMarkdown } from "./liquid-ask-markdown";
import { cn } from "@/lib/cn";

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function kindLabel(kind: string): string {
  if (kind === "sold") return "Sold";
  if (kind === "active") return "Listed";
  return "Reference";
}

function kindTone(kind: string): string {
  if (kind === "sold") return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/25";
  if (kind === "active") return "bg-amber-500/15 text-amber-200 ring-amber-500/25";
  return "bg-slate-500/15 text-slate-300 ring-white/10";
}

function hubStyles(platform: string): string {
  if (platform.startsWith("ebay"))
    return "border-amber-500/30 bg-amber-500/10 text-amber-50 hover:bg-amber-500/20";
  if (platform === "cardladder")
    return "border-sky-500/30 bg-sky-500/10 text-sky-50 hover:bg-sky-500/20";
  if (platform === "alt")
    return "border-violet-500/30 bg-violet-500/10 text-violet-50 hover:bg-violet-500/20";
  if (platform === "registry")
    return "border-violet-500/25 bg-violet-500/5 text-violet-100 hover:bg-violet-500/15";
  return "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10";
}

function DataCoverageBanner({
  coverage,
  researchedAt,
  todayUtc,
}: {
  coverage: LiquidAskDataCoverage;
  researchedAt: string;
  todayUtc: string;
}) {
  return (
    <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2.5">
      <div className="flex gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
        <div className="min-w-0 space-y-1 text-xs leading-relaxed text-slate-300">
          <p className="font-medium text-sky-100/95">
            Market data · {formatDate(researchedAt)} (today {todayUtc})
          </p>
          {coverage.geminiBriefUsed ? (
            <p className="text-sky-200/95">Live web brief via Gemini Google Search (free tier).</p>
          ) : null}
          {coverage.proWebBriefUsed ? (
            <p className="text-violet-200/95">Pro open-web brief (OpenRouter market model).</p>
          ) : null}
          {coverage.proMarketSkipped ? (
            <p className="text-amber-100/85">
              eBay sold API enrich is available on Pro — this answer used web search and Gemini grounding.
            </p>
          ) : null}
          {coverage.ebaySoldCount > 0 ? (
            <p>
              Automated comps:{" "}
              <span className="font-semibold text-amber-200">{coverage.ebaySoldCount} eBay sold</span>
              {coverage.ebayActiveCount > 0
                ? ` · ${coverage.ebayActiveCount} listing(s)`
                : ""}
            </p>
          ) : coverage.ebayConfigured ? (
            <p className="text-amber-100/80">eBay is configured — no sold rows matched this query yet.</p>
          ) : (
            <p className="text-amber-100/80">
              Add EBAY_FINDING_APP_ID or EBAY_CLIENT_ID on the server for automated sold comps.
            </p>
          )}
          <p className="text-slate-500">
            Card Ladder and ALT hold the deepest graded sales history — use the platform buttons below for full
            sold history, live auctions, and listings. Snippet rows are search highlights, not full databases.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlatformHubStrip({ research }: { research: LiquidAskResearch }) {
  if (research.hubLinks.length === 0) return null;

  const primary = research.hubLinks.filter((h) =>
    ["ebay_sold", "ebay_active", "cardladder", "alt"].some((p) => h.platform.startsWith(p) || h.platform === p),
  );
  const rest = research.hubLinks.filter((h) => !primary.includes(h));

  return (
    <section className="space-y-2.5">
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Open on platform
        </h4>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Best for last solds, live auctions, and listed graded inventory.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {primary.map((hub) => (
          <a
            key={`${hub.platform}-${hub.url}`}
            href={hub.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex min-h-[2.75rem] items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
              hubStyles(hub.platform),
            )}
          >
            <span>{hub.label}</span>
            <ExternalLink className="h-4 w-4 shrink-0 opacity-80" />
          </a>
        ))}
      </div>
      {rest.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {rest.map((hub) => (
            <a
              key={hub.url}
              href={hub.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                hubStyles(hub.platform),
              )}
            >
              {hub.label}
              <ExternalLink className="h-3 w-3 opacity-70" />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function LiquidAskResponsePanel({
  narrative,
  research,
  provider,
  streaming,
  statusMessage,
  className,
}: {
  narrative: string;
  research?: LiquidAskResearch | null;
  provider?: string;
  streaming?: boolean;
  statusMessage?: string | null;
  className?: string;
}) {
  const parts = research ? partitionComps(research.comps) : null;
  const coverage = research?.dataCoverage;

  return (
    <div className={cn("space-y-4", className)}>
      {research && coverage ? (
        <DataCoverageBanner
          coverage={coverage}
          researchedAt={research.researchedAt}
          todayUtc={research.todayUtc}
        />
      ) : null}

      {research && research.hubLinks.length > 0 ? (
        <PlatformHubStrip research={research} />
      ) : null}

      <div className="rounded-2xl rounded-tl-md border border-white/6 sc-glass-raised px-4 py-3">
        {statusMessage && streaming && !narrative.trim() ? (
          <p className="flex items-center gap-2 text-sm text-sky-300/90">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
            {statusMessage}
          </p>
        ) : null}
        {narrative.trim() ? (
          <LiquidAskMarkdown text={narrative} />
        ) : streaming && !statusMessage ? (
          <p className="text-sm text-slate-500">Thinking…</p>
        ) : !streaming && !narrative.trim() ? (
          <p className="text-sm text-slate-500">No narrative returned.</p>
        ) : null}
        {streaming && narrative.trim() ? (
          <span className="mt-2 inline-block h-4 w-0.5 animate-pulse bg-emerald-400 align-middle" />
        ) : null}
      </div>

      {research && parts ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-slate-600">
            {provider ? (
              <span className="rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/8">{provider}</span>
            ) : null}
            {coverage?.geminiUsed ? (
              <span className="rounded-md bg-white/5 px-2 py-1 ring-1 ring-white/8">Gemini search</span>
            ) : null}
          </div>

          {research.certLookups.length > 0 ? (
            <CertSection certs={research.certLookups} />
          ) : null}

          {parts.ebaySold.length > 0 ? (
            <CompSection
              title="eBay sold comps"
              subtitle="Highest-confidence automated sold data"
              icon={TrendingUp}
              comps={parts.ebaySold}
              accent="ebay"
            />
          ) : null}

          {parts.ebayActive.length > 0 ? (
            <CompSection
              title="eBay listings"
              subtitle="Live asks and buy-it-now"
              icon={LineChart}
              comps={parts.ebayActive}
              accent="ebay"
            />
          ) : null}

          {parts.otherSold.length > 0 || parts.otherActive.length > 0 ? (
            <CompSection
              title="Search highlights"
              subtitle="Card Ladder, ALT, and other sources via web search — open platform links for full history"
              icon={LineChart}
              comps={[...parts.otherSold, ...parts.otherActive].slice(0, 8)}
            />
          ) : null}

          {parts.reference.length > 0 ? (
            <CompSection title="Reference prices" icon={LineChart} comps={parts.reference.slice(0, 4)} />
          ) : null}

          {!streaming &&
          parts.ebaySold.length === 0 &&
          parts.ebayActive.length === 0 &&
          research.hubLinks.length > 0 ? (
            <p className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/90">
              No eBay sold rows were captured for this query. Use **eBay sold** above, or scan the card for a
              richer enrich pass.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CertSection({ certs }: { certs: LiquidAskResearch["certLookups"] }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-violet-300" aria-hidden />
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
          Cert lookup
        </h4>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {certs.map((cert) => (
          <article
            key={`${cert.grader}-${cert.cert}`}
            className="rounded-xl border border-violet-500/15 bg-violet-500/5 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm text-violet-100">
                  {cert.grader} #{cert.cert}
                </p>
                {cert.cardName ? <p className="mt-1 text-sm text-slate-200">{cert.cardName}</p> : null}
                {cert.grade ? <p className="mt-0.5 text-xs text-slate-400">Grade: {cert.grade}</p> : null}
              </div>
              {cert.verified ? <Award className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden /> : null}
            </div>
            {cert.populationNote ? (
              <p className="mt-2 text-xs text-slate-400">
                <span className="text-slate-500">Population: </span>
                {cert.populationNote}
              </p>
            ) : null}
            {cert.gradeDate ? (
              <p className="mt-1 text-xs text-slate-400">
                <span className="text-slate-500">Grade date: </span>
                {formatDate(cert.gradeDate)}
              </p>
            ) : null}
            {cert.dataProvider ? (
              <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">
                Source: {cert.dataProvider.replace(/_/g, " ")}
              </p>
            ) : null}
            <a
              href={cert.registryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
            >
              Open registry
              <ExternalLink className="h-3 w-3" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function CompSection({
  title,
  subtitle,
  icon: Icon,
  comps,
  accent,
}: {
  title: string;
  subtitle?: string;
  icon: typeof TrendingUp;
  comps: LiquidAskResearch["comps"];
  accent?: "ebay";
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon
          className={cn("h-4 w-4", accent === "ebay" ? "text-amber-300" : "text-emerald-300")}
          aria-hidden
        />
        <div>
          <h4
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              accent === "ebay" ? "text-amber-200/90" : "text-emerald-200/80",
            )}
          >
            {title}
          </h4>
          {subtitle ? <p className="text-[10px] text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {comps.map((comp, i) => (
          <CompCard key={`${comp.url ?? comp.title}-${i}`} comp={comp} accent={accent} />
        ))}
      </div>
    </section>
  );
}

function CompCard({
  comp,
  accent,
}: {
  comp: LiquidAskResearch["comps"][number];
  accent?: "ebay";
}) {
  return (
    <article
      className={cn(
        "flex gap-3 rounded-xl border p-2.5",
        accent === "ebay"
          ? "border-amber-500/15 bg-amber-500/[0.04]"
          : "border-white/8 bg-white/[0.02]",
      )}
    >
      {comp.imageUrl ? (
        <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={comp.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div
          className={cn(
            "flex h-14 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10",
            accent === "ebay" ? "bg-amber-500/10" : "bg-slate-800/80",
          )}
        >
          <span className="text-[9px] font-bold text-slate-500">
            {(comp.source ?? "—").slice(0, 3).toUpperCase()}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ring-1", kindTone(comp.kind))}>
            {kindLabel(comp.kind)}
          </span>
          <span className="font-mono text-sm text-emerald-100">{money(comp.priceUsd)}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-slate-300">{comp.title}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {[comp.source, comp.slab, formatDate(comp.observedAt)].filter(Boolean).join(" · ")}
        </p>
        {comp.url ? (
          <a
            href={comp.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-sky-400 hover:text-sky-300"
          >
            View listing
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
