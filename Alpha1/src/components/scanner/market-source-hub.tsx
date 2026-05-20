"use client";

import { ExternalLink } from "lucide-react";
import type { MarketSourceLink } from "@/lib/scan/schemas";

export function MarketSourceHub({
  links,
  compact = false,
}: {
  links: MarketSourceLink[];
  /** Dense pill row for insight canvas */
  compact?: boolean;
}) {
  if (links.length === 0) return null;

  if (compact) {
    const sold = links.filter((l) => l.lane === "sold");
    const listed = links.filter((l) => l.lane === "active");
    return (
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Market links</h3>
        <p className="mt-1 text-[11px] leading-snug text-muted">Click a venue to open search results for this card.</p>
        {sold.length > 0 ? (
          <div className="mt-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Sold / comps</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {sold.map((link) => (
                <a
                  key={`${link.source}-${link.lane}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-panel-raised/90 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:border-accent/40 hover:text-accent"
                >
                  {link.label.replace(/\s+sold$/i, "").replace(/\s+listed$/i, "")}
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {listed.length > 0 ? (
          <div className="mt-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Listed / asks</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {listed.map((link) => (
                <a
                  key={`${link.source}-${link.lane}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-panel-raised/90 px-2.5 py-1 text-[11px] font-medium text-primary transition hover:border-accent/40 hover:text-accent"
                >
                  {link.label.replace(/\s+listed$/i, "").replace(/\s+sold$/i, "")}
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Market sources</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={`${link.source}-${link.lane}`}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[2.75rem] items-center justify-between rounded-xl border border-border-subtle bg-panel-raised px-3 py-3 text-sm text-primary transition active:bg-subtle/50 hover:border-accent/40 sm:min-h-0 sm:rounded-lg sm:py-2 sm:text-xs"
          >
            <span>{link.label}</span>
            <ExternalLink className="h-3.5 w-3.5 text-accent" />
          </a>
        ))}
      </div>
    </section>
  );
}
