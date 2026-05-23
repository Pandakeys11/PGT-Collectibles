"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import { cn } from "@/lib/cn";
import { hasReadableCertNumber, isCertNotApplicable } from "@/lib/scan/graded-slab";

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
      </div>
    </section>
  );
}
