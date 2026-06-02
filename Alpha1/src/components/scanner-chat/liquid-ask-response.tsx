"use client";

import {
  Award,
  ExternalLink,
  Info,
  LineChart,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import type { LiquidAskCatalogCard, LiquidAskDataCoverage, LiquidAskMarketPulse, LiquidAskResearch } from "@/lib/scanner-chat/liquid-ask-types";
import { partitionComps } from "@/lib/scanner-chat/prioritize-comps";
import { MarketSourceLogo } from "@/components/market/market-source-logo";
import { normalizeMarketSource } from "@/lib/market/sources";
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
              Automated eBay sold ingest is off for this environment — open the platform links below for
              sold comps (queries match card, set, edition, and grade).
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
          ) : coverage.ebaySoldReady ? (
            coverage.snippetCompCount > 0 ? (
              <p className="text-amber-100/80">
                eBay sold pipeline returned no rows for this query — using{" "}
                <span className="font-semibold text-sky-200">
                  {coverage.snippetCompCount} session/search comp highlight(s)
                </span>{" "}
                from your scan enrich pass.
              </p>
            ) : (
              <p className="text-amber-100/80">
                eBay sold comps are enabled — no sold rows matched this query yet. Run enrich on
                cards or open platform links below for full sold history.
              </p>
            )
          ) : (
            <p className="text-amber-100/80">
              Add EBAY_FINDING_APP_ID or EBAY_CLIENT_ID on the server for automated sold comps.
            </p>
          )}
          <p className="text-slate-500">
            Card Ladder and ALT links below are pre-filled for this card, set, edition, and grade — open them
            for full sold history and listings (we do not have partner API access). Snippet rows are highlights
            only.
          </p>
        </div>
      </div>
    </div>
  );
}

function sentimentTone(sentiment: LiquidAskMarketPulse["sentiment"]): string {
  switch (sentiment) {
    case "bullish":
      return "border-emerald-500/25 bg-emerald-500/8 text-emerald-100";
    case "bearish":
      return "border-rose-500/25 bg-rose-500/8 text-rose-100";
    case "neutral":
      return "border-sky-500/25 bg-sky-500/8 text-sky-100";
    default:
      return "border-amber-500/20 bg-amber-500/6 text-amber-100";
  }
}

function sentimentLabel(sentiment: LiquidAskMarketPulse["sentiment"]): string {
  switch (sentiment) {
    case "bullish":
      return "Bullish";
    case "bearish":
      return "Bearish";
    case "neutral":
      return "Neutral";
    default:
      return "Thin market";
  }
}

function CatalogVisualStrip({ cards }: { cards: LiquidAskCatalogCard[] }) {
  if (cards.length === 0) return null;

  return (
    <section className="space-y-2" aria-label="Catalog card references">
      <div>
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Master catalog
        </h4>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Official artwork from your scan or catalog match — referenced in the answer below.
        </p>
      </div>
      <div className="sc-liquid-ask-catalog-strip flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
        {cards.map((card) => (
          <article
            key={`${card.catalogId ?? card.name}-${card.role}`}
            className={cn(
              "flex w-[4.75rem] shrink-0 flex-col gap-1 sm:w-[5.25rem]",
              card.role === "focus" && "ring-1 ring-amber-400/30 rounded-xl p-0.5",
            )}
          >
            <div className="aspect-[5/7] overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.imageUrl}
                alt=""
                className="h-full w-full object-contain p-0.5"
                loading="lazy"
              />
            </div>
            <p className="line-clamp-2 text-[9px] font-medium leading-tight text-slate-200">
              {card.name}
            </p>
            <p className="line-clamp-1 text-[8px] text-slate-500">
              {[card.setName, card.number ? `#${card.number}` : null].filter(Boolean).join(" · ")}
            </p>
            {card.rawFmvUsd != null && Number.isFinite(card.rawFmvUsd) ? (
              <p className="font-mono text-[9px] text-amber-200/90">{money(card.rawFmvUsd)} FMV</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function MarketPulseBanner({ pulse }: { pulse: LiquidAskMarketPulse }) {
  return (
    <section
      className={cn("rounded-xl border px-3 py-2.5", sentimentTone(pulse.sentiment))}
      aria-label="Market pulse"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {sentimentLabel(pulse.sentiment)}
        </span>
        <span className="text-[10px] opacity-80">
          {pulse.soldCount} sold{pulse.activeCount > 0 ? ` · ${pulse.activeCount} listed` : ""}
          {pulse.soldMedianUsd != null ? ` · med ${money(pulse.soldMedianUsd)}` : ""}
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed opacity-95">{pulse.stanceHint}</p>
    </section>
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
            <MarketSourceLogo label={hub.label} />
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
              <MarketSourceLogo label={hub.label} />
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

      {research && research.catalogCards.length > 0 ? (
        <CatalogVisualStrip cards={research.catalogCards} />
      ) : null}

      {research?.marketPulse ? <MarketPulseBanner pulse={research.marketPulse} /> : null}

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
        {!streaming && narrative.includes("All text providers failed") ? (
          <p className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-100/95">
            All cloud LLM quotas are exhausted. Fix billing on Groq/OpenAI/Gemini, or set{" "}
            <span className="font-mono text-rose-50">OPENROUTER_TEXT_MODEL=meta-llama/llama-3.3-70b-instruct:free</span>{" "}
            and <span className="font-mono text-rose-50">TEXT_PROVIDER_ORDER=openrouter,...</span>.
            Session reports should still render via <strong>local desk mode</strong> using your enrich
            comps — re-run the scan if you only see this error.
          </p>
        ) : null}
        {provider === "local-desk" ? (
          <p className="mt-2 text-[10px] text-slate-500">
            Report source: session enrich data (LLM providers unavailable).
          </p>
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

          {parts.priceChartingSold.length > 0 ? (
            <CompSection
              title="PriceCharting recent solds"
              subtitle="Completed auctions from PriceCharting product history (often eBay-backed)"
              icon={TrendingUp}
              comps={parts.priceChartingSold}
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
            "flex h-14 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10 px-0.5",
            accent === "ebay" ? "bg-amber-500/10" : "bg-slate-800/80",
          )}
        >
          <MarketSourceLogo
            label={comp.source ?? "Market"}
            sourceId={normalizeMarketSource(comp.source)}
            variant="compact"
          />
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
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
          {comp.source ? (
            <MarketSourceLogo
              label={comp.source}
              sourceId={normalizeMarketSource(comp.source)}
              variant="compact"
            />
          ) : null}
          {comp.slab ? <span>{comp.slab}</span> : null}
          {comp.observedAt ? (
            <>
              {(comp.source || comp.slab) && <span className="text-slate-600">·</span>}
              <span>{formatDate(comp.observedAt)}</span>
            </>
          ) : null}
        </div>
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
