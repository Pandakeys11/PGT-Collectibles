"use client";

import type { SourceSummary } from "@/lib/scan/sheet-present";
import { cn } from "@/lib/cn";

export function SourceChips({
  sources,
  maxVisible = 3,
  className,
}: {
  sources: SourceSummary[];
  maxVisible?: number;
  className?: string;
}) {
  if (sources.length === 0) {
    return <span className="text-[10px] text-faint">—</span>;
  }
  const visible = sources.slice(0, maxVisible);
  const overflow = sources.length - visible.length;
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {visible.map((entry) => {
        const lanes: string[] = [];
        if (entry.hasSold) lanes.push("S");
        if (entry.hasActive) lanes.push("L");
        const label = `${entry.label}${lanes.length ? ` ${lanes.join("/")}` : ""}`;
        if (entry.link) {
          return (
            <a
              key={entry.label}
              href={entry.link}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="max-w-full truncate rounded border border-border-subtle bg-panel-raised px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted hover:border-accent/40 hover:text-primary"
              title={`${entry.label}${entry.evidenceCount ? ` (${entry.evidenceCount} rows)` : ""}`}
            >
              {label}
            </a>
          );
        }
        return (
          <span
            key={entry.label}
            className="max-w-full truncate rounded border border-border-subtle px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted"
            title={entry.label}
          >
            {label}
          </span>
        );
      })}
      {overflow > 0 ? (
        <span className="shrink-0 text-[10px] font-medium text-faint" title={sources.map((s) => s.label).join(", ")}>
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
