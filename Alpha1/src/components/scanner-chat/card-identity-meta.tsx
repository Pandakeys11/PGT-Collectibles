"use client";

import type { CardMatch } from "@/lib/scanner-chat/types";
import { buildCardIdentityFields } from "@/lib/scanner-chat/format-card-identity";
import { cn } from "@/lib/cn";

const VERSION_TONE: Record<string, string> = {
  confirm:
    "border-amber-400/35 bg-amber-500/12 text-amber-100",
  default:
    "border-violet-400/35 bg-violet-500/14 text-violet-100",
};

export function CardIdentityMeta({
  card,
  variant = "list",
  className,
}: {
  card: CardMatch;
  variant?: "list" | "panel" | "compact";
  className?: string;
}) {
  const id = buildCardIdentityFields(card);

  if (variant === "compact") {
    return (
      <div className={cn("min-w-0 space-y-0.5", className)}>
        <p className="truncate text-[13px] font-semibold text-slate-100">{id.name}</p>
        <p className="truncate font-mono text-[11px] text-slate-500">{id.metaLine}</p>
        {id.version ? (
          <p
            className={cn(
              "truncate text-[11px] font-medium",
              id.needsVersionConfirm ? "text-amber-200" : "text-violet-200/95",
            )}
          >
            {id.version}
          </p>
        ) : null}
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div className={cn("min-w-0", className)}>
        <h3 className="truncate font-display text-lg font-semibold leading-snug text-white sm:text-xl">
          {id.name}
        </h3>
        <dl className="mt-2 space-y-1.5 text-left">
          <IdentityRow label="Set" value={id.setName} mono={false} />
          <IdentityRow label="ID" value={id.collectorId} mono />
          <IdentityRow label="Year" value={id.year} mono />
          <IdentityRow
            label="Version"
            value={id.version || "—"}
            mono={false}
            highlight={id.needsVersionConfirm ? "confirm" : id.version ? "default" : undefined}
          />
          {id.promo ? <IdentityRow label="Promo" value={id.promo} mono={false} highlight="default" /> : null}
          {id.catalogId ? (
            <IdentityRow label="Catalog" value={id.catalogId} mono className="text-slate-500" />
          ) : null}
        </dl>
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      <h4 className="text-[13px] font-semibold text-slate-100 sm:text-sm">{id.name}</h4>
      <p className="mt-0.5 font-mono text-[11px] leading-relaxed text-slate-500 sm:text-xs">
        {id.metaLine}
      </p>
      {id.version || id.promo ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {id.version ? (
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[11px] font-medium sm:text-xs",
                id.needsVersionConfirm ? VERSION_TONE.confirm : VERSION_TONE.default,
              )}
            >
              {id.version}
            </span>
          ) : null}
          {id.promo ? (
            <span className="rounded-md border border-fuchsia-500/25 bg-fuchsia-500/10 px-1.5 py-0.5 text-[11px] font-medium text-fuchsia-200/90 sm:text-xs">
              {id.promo}
            </span>
          ) : null}
        </div>
      ) : null}
      {id.catalogId ? (
        <p className="mt-1 truncate font-mono text-[10px] text-slate-600" title={id.catalogId}>
          Catalog {id.catalogId}
        </p>
      ) : null}
    </div>
  );
}

function IdentityRow({
  label,
  value,
  mono,
  highlight,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "default" | "confirm";
  className?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 text-[11px] sm:text-xs">
      <dt className="w-14 shrink-0 font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate",
          mono ? "font-mono tabular-nums text-slate-300" : "text-slate-200",
          highlight === "confirm"
            ? "rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-100"
            : highlight === "default"
              ? "rounded-md border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-violet-100"
              : "",
          className,
        )}
      >
        {value}
      </dd>
    </div>
  );
}
