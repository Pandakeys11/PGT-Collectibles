"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Loader2, Package } from "lucide-react";
import type { MarketSourceLink } from "@/lib/market/sources";
import type { SetOverviewPayload } from "@/lib/pokedex/set-overview-payload";
import { cn } from "@/lib/cn";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function hubUrl(links: MarketSourceLink[], source: MarketSourceLink["source"], lane: MarketSourceLink["lane"]) {
  return links.find((l) => l.source === source && l.lane === lane)?.url ?? null;
}

export function PokedexSetOverviewPanel(props: {
  setId: string;
  setName: string;
  /** When true, user expands before the heavy set-overview fetch runs. */
  lazy?: boolean;
}) {
  const { setId, lazy = true } = props;
  const [expanded, setExpanded] = useState(!lazy);
  const [data, setData] = useState<SetOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    void fetch(`/api/pokedex/set-overview?setId=${encodeURIComponent(setId)}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => ({}))) as SetOverviewPayload & { error?: string };
        if (!r.ok) throw new Error(body.error || `Request failed (${r.status})`);
        return body as SetOverviewPayload;
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load set overview");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [setId, expanded]);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border-subtle bg-panel-raised/30 px-3 py-2.5 text-left text-xs font-medium text-primary transition hover:border-accent/30 hover:bg-panel-raised/50 touch-manipulation"
      >
        <span className="inline-flex items-center gap-2">
          <Package className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
          Set value & sealed references
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border-subtle bg-panel-raised/30 px-3 py-2.5 text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
        <span>Loading set value & sealed references…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="rounded-xl border border-border-subtle bg-panel-raised/30 px-3 py-2 text-xs text-danger">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setData(null);
          }}
          className="text-xs font-medium text-accent hover:underline touch-manipulation"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data?.supported) return null;

  const { pricing, sealedProducts, references, setValueNotes } = data;
  const tcgPct =
    pricing.cardCount > 0 ? Math.round((100 * pricing.tcgPlayerPricedSlots) / pricing.cardCount) : 0;
  const cmPct =
    pricing.cardCount > 0 ? Math.round((100 * pricing.cardmarketPricedSlots) / pricing.cardCount) : 0;

  return (
    <section
      className="shrink-0 rounded-xl border border-border-subtle bg-panel-raised/25 p-3"
      aria-label="Set value and sealed product references"
    >
      <div className="flex items-start gap-2">
        <Package className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">Set value & sealed products</h3>
        </div>
      </div>

      {setValueNotes ? <p className="mt-2 text-[10px] leading-snug text-accent/90">{setValueNotes}</p> : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-canvas/40 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Near-set value</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-primary">{formatUsd(pricing.tcgPlayerSumUsd)}</p>
          <p className="mt-0.5 text-[10px] text-muted">
            TCGPlayer · {pricing.tcgPlayerPricedSlots} of {pricing.cardCount} cards priced ({tcgPct}%)
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-canvas/40 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Cardmarket trend</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-primary">{formatEur(pricing.cardmarketSumEur)}</p>
          <p className="mt-0.5 text-[10px] text-muted">
            {pricing.cardmarketPricedSlots} of {pricing.cardCount} cards ({cmPct}%)
          </p>
        </div>
      </div>

      {references.length ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border-subtle pt-2">
          {references.map((ref) => (
            <a
              key={ref.url}
              href={ref.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-medium text-accent underline-offset-2 hover:underline"
            >
              {ref.label}
              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
            </a>
          ))}
        </div>
      ) : null}

      {sealedProducts.length ? (
        <div className="mt-3 border-t border-border-subtle pt-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-faint">Sealed products</p>
          <ul className="mt-2 space-y-2">
            {sealedProducts.map((row) => {
              const ebaySold = hubUrl(row.links, "ebay", "sold");
              const ebayAct = hubUrl(row.links, "ebay", "active");
              const tcgSold = hubUrl(row.links, "tcgplayer", "sold");
              const pc = hubUrl(row.links, "pricecharting", "sold");
              return (
                <li
                  key={row.id}
                  className="rounded-lg border border-border-subtle bg-panel-raised/30 px-2.5 py-2 text-[11px]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-medium text-primary">{row.label}</span>
                    <span className="text-[9px] uppercase tracking-wide text-faint">
                      {row.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ebaySold ? (
                      <a
                        href={ebaySold}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "rounded-md border border-border-subtle bg-canvas/50 px-2 py-1 text-[10px] font-medium",
                          "text-primary hover:border-accent/50",
                        )}
                      >
                        eBay sold
                      </a>
                    ) : null}
                    {ebayAct ? (
                      <a
                        href={ebayAct}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "rounded-md border border-border-subtle bg-canvas/50 px-2 py-1 text-[10px] font-medium",
                          "text-primary hover:border-accent/50",
                        )}
                      >
                        eBay listed
                      </a>
                    ) : null}
                    {tcgSold ? (
                      <a
                        href={tcgSold}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "rounded-md border border-border-subtle bg-canvas/50 px-2 py-1 text-[10px] font-medium",
                          "text-primary hover:border-accent/50",
                        )}
                      >
                        TCGPlayer
                      </a>
                    ) : null}
                    {pc ? (
                      <a
                        href={pc}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "rounded-md border border-border-subtle bg-canvas/50 px-2 py-1 text-[10px] font-medium",
                          "text-primary hover:border-accent/50",
                        )}
                      >
                        PriceCharting
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
