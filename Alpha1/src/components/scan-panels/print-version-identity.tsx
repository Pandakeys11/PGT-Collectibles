"use client";

import { AlertTriangle } from "lucide-react";
import type { ScanSpecimen } from "@/hooks/use-scan-session";
import {
  buildPrintIdentitySnapshot,
  editionBadgeTone,
  formatPrintIdentityStatusLabel,
  type PrintIdentitySnapshot,
} from "@/lib/scan/print-identity-ui";
import { cn } from "@/lib/cn";

const BADGE_TONE_CLASS = {
  violet: "border-violet-500/30 bg-violet-500/12 text-violet-100",
  amber: "border-amber-500/30 bg-amber-500/12 text-amber-100",
  sky: "border-sky-500/30 bg-sky-500/12 text-sky-100",
  fuchsia: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-100",
  slate: "border-slate-400/25 bg-slate-500/10 text-slate-200",
} as const;

export function PrintVersionBadges({
  snapshot,
  className,
  size = "sm",
}: {
  snapshot: PrintIdentitySnapshot;
  className?: string;
  size?: "sm" | "xs";
}) {
  const tone = editionBadgeTone(snapshot.editionId);
  const toneClass = BADGE_TONE_CLASS[tone];
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]";

  const hasVersion = Boolean(snapshot.version);
  const hasPromo = Boolean(snapshot.promo && snapshot.promo !== snapshot.version);

  if (!hasVersion && !hasPromo && !snapshot.catalogVariant) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {hasVersion ? (
        <span className={cn("rounded-md border font-medium", pad, toneClass)} title="Print run / version">
          {snapshot.version}
        </span>
      ) : snapshot.status === "needs_confirm" ? (
        <span
          className={cn(
            "rounded-md border border-amber-500/35 bg-amber-500/10 font-medium text-amber-100",
            pad,
          )}
        >
          Confirm print run
        </span>
      ) : null}
      {hasPromo ? (
        <span
          className={cn(
            "rounded-md border border-fuchsia-500/25 bg-fuchsia-500/10 font-medium text-fuchsia-100/95",
            pad,
          )}
        >
          {snapshot.promo}
        </span>
      ) : null}
      {snapshot.catalogVariant ? (
        <span
          className={cn(
            "rounded-md border border-cyan-500/25 bg-cyan-500/10 font-medium text-cyan-100/95",
            pad,
          )}
          title="Catalog variant row"
        >
          Catalog: {snapshot.catalogVariant}
        </span>
      ) : null}
    </div>
  );
}

export function PrintEditionCallout({
  snapshot,
  className,
}: {
  snapshot: PrintIdentitySnapshot;
  className?: string;
}) {
  if (!snapshot.blocker) return null;
  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-100/95",
        className,
      )}
      role="status"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
      <p>{snapshot.blocker}</p>
    </div>
  );
}

export function PrintIdentityDetailBlock({
  specimen,
  dense = false,
}: {
  specimen: ScanSpecimen;
  dense?: boolean;
}) {
  const snapshot = buildPrintIdentitySnapshot(specimen);
  const statusLabel = formatPrintIdentityStatusLabel(snapshot.status);
  const versionDisplay = snapshot.version || "—";
  const promoDisplay = snapshot.promo && snapshot.promo !== snapshot.version ? snapshot.promo : null;
  const showRaw =
    snapshot.rawStamps &&
    snapshot.rawStamps !== snapshot.version &&
    !snapshot.version.includes(snapshot.rawStamps);

  const rows: Array<{ label: string; value: string; valueClass?: string }> = [
    {
      label: "Print / version",
      value: versionDisplay,
      valueClass: "text-violet-200/95 font-medium",
    },
    ...(promoDisplay
      ? [{ label: "Promo", value: promoDisplay, valueClass: "text-fuchsia-200/90 font-medium" }]
      : []),
    ...(snapshot.catalogVariant
      ? [
          {
            label: "Catalog variant",
            value: snapshot.catalogVariant,
            valueClass: "text-cyan-200/90 font-medium",
          },
        ]
      : []),
    {
      label: "Version status",
      value: statusLabel,
      valueClass:
        snapshot.status === "needs_confirm"
          ? "text-amber-200/95 font-medium"
          : snapshot.status === "confirmed"
            ? "text-emerald-200/90"
            : "text-slate-400",
    },
    ...(showRaw
      ? [{ label: "Stamp text", value: snapshot.rawStamps!, valueClass: "text-slate-400 text-[10px]" }]
      : []),
  ];

  if (dense) {
    return (
      <>
        <PrintEditionCallout snapshot={snapshot} className="mb-2" />
        <dl className="sc-identity-sheet-grid divide-y divide-white/[0.06] rounded-md border border-white/8 bg-white/[0.02]">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[minmax(4.25rem,5.25rem)_1fr] items-baseline gap-x-2 px-2 py-1"
            >
              <dt className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                {row.label}
              </dt>
              <dd
                className={cn(
                  "min-w-0 text-[11px] leading-snug text-slate-300 break-words",
                  row.valueClass,
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </>
    );
  }

  return (
    <>
      <PrintEditionCallout snapshot={snapshot} className="mb-2" />
      <dl className="space-y-2 text-[11px] sm:text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{row.label}</dt>
            <dd
              className={cn("max-w-[58%] text-right break-words", row.valueClass ?? "text-slate-200")}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
