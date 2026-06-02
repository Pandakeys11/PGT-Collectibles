"use client";

import { useMemo } from "react";
import { ExternalLink, Package } from "lucide-react";
import { MarketSourceLogo } from "@/components/market/market-source-logo";
import {
  primaryTrackedLinks,
  resolveDisplaySealedProducts,
} from "@/lib/catalog/set-insight-sealed";
import type { SetInsightSealedProduct } from "@/lib/catalog/set-insight-payload";
import { cn } from "@/lib/cn";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

function trackedLabel(row: SetInsightSealedProduct): string | null {
  if (row.priceLabel?.trim()) return row.priceLabel.trim();
  if (row.priceUsd == null) return null;
  if (row.trackedSource === "pricecharting") return "PriceCharting FMV";
  if (row.trackedSource === "ebay_sold") return "eBay sold comps";
  return "FMV estimate";
}

export function CatalogSetSealedFmvPanel({
  setId,
  setName,
  sealedProducts,
  loading = false,
  className,
}: {
  setId: string;
  setName: string;
  sealedProducts?: SetInsightSealedProduct[] | null;
  loading?: boolean;
  className?: string;
}) {
  const rows = useMemo(
    () => resolveDisplaySealedProducts(setId, setName, sealedProducts),
    [setId, setName, sealedProducts],
  );

  return (
    <section
      className={cn("sc-catalog-sealed-fmv min-w-0", className)}
      aria-label="Sealed product FMV"
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <Package className="h-3 w-3 shrink-0 text-amber-300/90" aria-hidden />
        <p className="text-[9px] font-semibold uppercase tracking-wide text-faint">Sealed FMV</p>
        {loading ? (
          <span className="text-[8px] text-muted">Updating…</span>
        ) : (
          <span className="text-[8px] text-muted">{rows.length} products</span>
        )}
      </div>

      <ul className="space-y-1">
        {rows.map((row, i) => {
          const links = primaryTrackedLinks(row.marketLinks);
          const basis = trackedLabel(row);
          return (
            <li
              key={`${row.label}-${i}`}
              className="rounded-md border border-white/6 bg-black/20 px-2 py-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium leading-snug text-primary">{row.label}</p>
                  {row.note ? (
                    <p className="text-[8px] uppercase tracking-wide text-faint">{row.note}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[11px] font-semibold text-amber-200">
                    {row.priceUsd != null ? fmtUsd(row.priceUsd) : "—"}
                  </p>
                  <p className="text-[8px] uppercase tracking-wide text-faint">
                    {basis ?? (row.priceUsd == null ? "FMV pending" : "Tracked")}
                  </p>
                </div>
              </div>

              {links.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {links.map((link) => (
                    <a
                      key={`${link.source}-${link.lane}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] font-medium text-primary transition hover:border-amber-500/35 hover:bg-amber-500/[0.06]"
                    >
                      <MarketSourceLogo
                        label={link.label}
                        sourceId={link.source}
                        variant="compact"
                        hideLaneChips
                        className="shrink-0 scale-[0.85] origin-left"
                      />
                      <ExternalLink className="h-2 w-2 shrink-0 opacity-60" aria-hidden />
                    </a>
                  ))}
                </div>
              ) : row.searchUrl ? (
                <a
                  href={row.searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[9px] font-medium text-amber-300 hover:underline"
                >
                  Market search
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
