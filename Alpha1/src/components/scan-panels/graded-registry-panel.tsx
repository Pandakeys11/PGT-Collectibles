"use client";

import { AlertTriangle, BadgeCheck, CircleHelp, ExternalLink, Loader2 } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { cn } from "@/lib/cn";
import { hasReadableCertNumber, isCertNotApplicable } from "@/lib/scan/graded-slab";
import { sortEvidenceNewestFirst } from "@/lib/scan/market-intelligence";

export function specimenShowsGradedRegistry(
  specimen: Pick<ScanSpecimen, "card" | "context"> | null,
): boolean {
  if (!specimen) return false;
  return specimen.context.lane === "graded" || hasReadableCertNumber(specimen.card.cert);
}

function normalizeSupplyText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text && text.length > 0 ? text : null;
}

function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function formatEvidenceDate(iso: string | null | undefined): string {
  if (!iso) return "Best-effort match";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Best-effort match";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function GradedRegistryPanel({
  specimen,
  enriching = false,
  variant = "default",
  className,
  supplementalSupply,
}: {
  specimen: Pick<ScanSpecimen, "card" | "context">;
  enriching?: boolean;
  variant?: "default" | "compact" | "inline";
  className?: string;
  /** Optional narrated supply (AI brief) — appended when distinct from enrich population. */
  supplementalSupply?: string | null;
}) {
  if (!specimenShowsGradedRegistry(specimen)) return null;

  const population = normalizeSupplyText(specimen.context.populationSummary);
  const registryUrl = specimen.context.registryUrl?.trim() || null;
  const certProvider = specimen.context.certProvider?.trim() || null;
  const certGradeDate = specimen.context.certGradeDate?.trim() || null;
  const certSoldCount = (specimen.context.certMarketEvidence ?? []).filter(
    (r) => r.kind === "sold",
  ).length;
  const extra = normalizeSupplyText(supplementalSupply);
  const showExtra = Boolean(extra && extra !== population);

  const certDigits = hasReadableCertNumber(specimen.card.cert)
    ? (specimen.card.cert ?? "").replace(/\D/g, "")
    : null;

  const certField =
    specimen.context.verificationFields?.find((f) => f.field === "cert") ?? null;
  const certFieldStatus = certField?.status ?? "unverified";

  const certLookupReady = Boolean(registryUrl);
  const certLookupVerified = Boolean(population && registryUrl);

  const certSoldRows = sortEvidenceNewestFirst(
    specimen.context.certMarketEvidence ?? [],
  )
    .filter((r) => r.kind === "sold")
    .slice(0, 3);

  const metaLine = [
    certProvider ? `Source: ${certProvider.replace(/_/g, " ")}` : null,
    certGradeDate ? `Graded ${certGradeDate}` : null,
    certSoldCount > 0 ? `${certSoldCount} cert-tied sold row(s) in Market` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const pending = enriching && !population && !registryUrl;
  const waiting =
    !enriching &&
    !population &&
    !registryUrl &&
    hasReadableCertNumber(specimen.card.cert);

  if (variant === "inline") {
    if (!population && !registryUrl && !showExtra && !pending && !waiting) return null;
    return (
      <p className={cn("text-[11px] leading-snug text-muted break-words", className)}>
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-faint">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading registry & population…
          </span>
        ) : waiting ? (
          <span className="text-faint">Loading registry when this slab is selected…</span>
        ) : (
          <>
            {population ? <span className="text-primary">{population}</span> : null}
            {showExtra ? (
              <span className={population ? " block mt-1 text-faint" : "text-primary"}>{extra}</span>
            ) : null}
            {registryUrl ? (
              <a
                href={registryUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-accent hover:underline"
              >
                Registry
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </>
        )}
      </p>
    );
  }

  const compact = variant === "compact";

  return (
    <section
      className={cn(
        compact
          ? "min-w-0 rounded-lg border border-border-subtle bg-panel-raised/30 px-3 py-2"
          : "min-w-0 rounded-xl border border-border-subtle bg-panel-raised/40 px-3 py-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3
          className={cn(
            "font-semibold uppercase tracking-wide text-faint",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          Graded supply
        </h3>
        {registryUrl && !pending ? (
          <a
            href={registryUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex min-h-[2rem] items-center gap-1.5 font-medium text-accent touch-manipulation hover:underline sm:min-h-0",
              compact ? "text-[11px]" : "text-sm",
            )}
          >
            Open registry
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        ) : null}
      </div>

      <div className={cn("min-w-0", compact ? "mt-1.5" : "mt-2")}>
        {pending ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted sm:text-xs">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" aria-hidden />
            Loading registry and population from cert…
          </p>
        ) : waiting ? (
          <p className="text-sm leading-relaxed text-muted sm:text-xs sm:leading-6">
            {isCertNotApplicable(specimen.card.cert)
              ? "Cert shows NA (often on back of slab) — enter cert # above, then registry loads."
              : "Cert detected — open this row to load registry and population."}
          </p>
        ) : population || showExtra || metaLine ? (
          <div className="space-y-2">
            {population ? (
              <p
                className={cn(
                  "leading-relaxed text-primary break-words",
                  compact ? "text-[11px] leading-snug" : "text-sm sm:text-xs sm:leading-6",
                )}
              >
                {population}
              </p>
            ) : null}
            {metaLine ? (
              <p
                className={cn(
                  "leading-relaxed text-muted break-words",
                  compact ? "text-[10px] leading-snug" : "text-xs sm:leading-5",
                )}
              >
                {metaLine}
              </p>
            ) : null}
            {showExtra ? (
              <p
                className={cn(
                  "leading-relaxed text-muted break-words",
                  compact ? "text-[10px] leading-snug" : "text-sm sm:text-xs sm:leading-6",
                )}
              >
                {extra}
              </p>
            ) : null}
          </div>
        ) : registryUrl ? (
          <p className="text-sm text-muted sm:text-xs">
            Registry verified — open the grader link for full population tables.
          </p>
        ) : (
          <p className="text-sm text-muted sm:text-xs">
            Add a readable cert number and run enrich to load population.
          </p>
        )}

        {certDigits ? (
          <div
            className={cn(
              "mt-3 rounded-lg border bg-white/[0.02] p-2.5",
              compact ? "px-2 py-2" : "p-2.5",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                Cert verification
              </p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                  certLookupVerified
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : certLookupReady
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
                      : "border-white/10 bg-white/5 text-slate-300",
                )}
              >
                {certLookupVerified ? (
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                ) : certLookupReady ? (
                  <CircleHelp className="h-3 w-3" aria-hidden />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                )}
                {certLookupVerified
                  ? "Verified"
                  : certLookupReady
                    ? "Lookup loaded"
                    : "Not loaded"}
              </span>
            </div>

            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-slate-300">
                  Cert # <span className="font-mono text-slate-100">{certDigits}</span>
                  {certProvider ? (
                    <>
                      {" "}
                      · Source:{" "}
                      <span className="text-slate-200">{certProvider.replace(/_/g, " ")}</span>
                    </>
                  ) : null}
                </p>
                {certGradeDate ? <p className="text-[11px] text-muted">Graded {certGradeDate}</p> : null}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted">
                {certFieldStatus === "verified" ? (
                  <BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden />
                ) : certFieldStatus === "mismatch" ? (
                  <AlertTriangle className="h-4 w-4 text-rose-300" aria-hidden />
                ) : (
                  <CircleHelp className="h-4 w-4 text-amber-200" aria-hidden />
                )}
                <span>
                  Vision ↔ registry check:{" "}
                  <span className="text-slate-200">
                    {certFieldStatus === "verified"
                      ? "cert matches"
                      : certFieldStatus === "mismatch"
                        ? "cert mismatch"
                        : "cert not verified"}
                  </span>
                </span>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                  This exact cert — last sold
                </p>
                {certSoldRows.length > 0 ? (
                  <ul className={cn("mt-2 space-y-1", compact ? "text-[11px]" : "text-[11px]")}>
                    {certSoldRows.map((row) => (
                      <li
                        key={`${row.url ?? row.title}|${row.priceUsd ?? ""}`}
                        className="flex items-start justify-between gap-3 rounded-md bg-white/[0.03] px-2 py-1.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-slate-200">{row.title}</p>
                          <p className="text-[10px] text-muted">{formatEvidenceDate(row.observedAt)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-[11px] text-slate-100 tabular-nums">
                            {formatUsd(row.priceUsd)}
                          </p>
                          {row.url ? (
                            <a
                              href={row.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent hover:underline"
                            >
                              Open
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-muted">
                    No exact-cert sold comps captured yet. Similar grade comps are shown in the Market rail.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-[10px] text-faint">Similar sales (same grade)</p>
                {specimen.context.ebaySoldSearchUrl ? (
                  <a
                    href={specimen.context.ebaySoldSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                  >
                    eBay sold search
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
