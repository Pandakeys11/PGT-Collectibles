"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { evidenceRowKey } from "@/lib/scan/comps-analytics";
import {
  buildEbayGradeHubs,
  buildHubUrlMap,
  resolveEvidenceExternalUrl,
  type EbayGradeHub,
  type EbayGradeHubKey,
} from "@/lib/market/sources";
import type { ExtractedCard, MarketEvidence, MarketSourceLink } from "@/lib/scan/schemas";

function slabToEbayGradeKey(slab: string | null | undefined): EbayGradeHubKey {
  if (!slab) return "raw";
  if (/psa\s*10/i.test(slab)) return "psa10";
  if (/psa\s*9/i.test(slab)) return "psa9";
  if (/black\s*label|bgs.*black/i.test(slab)) return "bgsBlackLabel";
  if (/pristine|cgc/i.test(slab) && /10/i.test(slab)) return "cgcPristine10";
  return "raw";
}

function formatUsd(value: number | null): string {
  if (value == null) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export function MarketEvidenceTable({
  items,
  hubLinks = [],
  card,
  maxRows,
  excludedKeys,
  outlierKeys,
  onToggleExclude,
}: {
  items: MarketEvidence[];
  hubLinks?: MarketSourceLink[];
  /** Enables grade-scoped eBay hub links (same as Pokédex market panel). */
  card?: ExtractedCard | null;
  /** Limit rows in tight layouts (e.g. insight canvas). */
  maxRows?: number;
  excludedKeys?: Set<string>;
  outlierKeys?: Set<string>;
  onToggleExclude?: (key: string) => void;
}) {
  const hub = useMemo(() => buildHubUrlMap(hubLinks), [hubLinks]);
  const ebayGradeHubs = useMemo(
    () => (card ? buildEbayGradeHubs(card) : null),
    [card],
  );

  if (items.length === 0) {
    return <p className="text-sm text-muted sm:text-xs">No market samples loaded yet.</p>;
  }

  const visible = typeof maxRows === "number" ? items.slice(0, Math.max(1, maxRows)) : items;
  const hidden = typeof maxRows === "number" ? Math.max(0, items.length - visible.length) : 0;

  return (
    <div className="w-full max-w-full overflow-x-hidden rounded-xl border border-border-subtle">
      <table className="w-full table-fixed text-left text-xs sm:text-sm">
        <colgroup>
          <col className="w-[12%]" />
          <col className="w-[18%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
          <col className="w-[26%]" />
        </colgroup>
        <thead className="bg-panel-raised text-muted">
          <tr>
            {onToggleExclude ? <th className="w-[8%] px-1 py-2 font-medium">Use</th> : null}
            <th className="px-2 py-2 font-medium">Type</th>
            <th className="px-2 py-2 font-medium">Slab</th>
            <th className="px-2 py-2 font-medium">Price</th>
            <th className="px-2 py-2 font-medium">Date</th>
            <th className="px-2 py-2 font-medium">Source</th>
            <th className="px-2 py-2 font-medium">Link</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((item) => {
            const rowKey = evidenceRowKey(item);
            const excluded = excludedKeys?.has(rowKey) ?? false;
            const outlier = outlierKeys?.has(rowKey) ?? false;
            const gradeHub: EbayGradeHub | undefined = ebayGradeHubs
              ? ebayGradeHubs[slabToEbayGradeKey(item.slab)]
              : undefined;
            const href = resolveEvidenceExternalUrl(item, hub, { ebayGradeHub: gradeHub });
            return (
            <tr
              key={rowKey}
              className={cn(
                "border-t border-border-subtle",
                excluded && "opacity-45",
                outlier && !excluded && "bg-rose-500/5",
              )}
            >
              {onToggleExclude ? (
                <td className="px-1 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={!excluded}
                    aria-label="Include comp in FMV"
                    className="h-3.5 w-3.5 accent-emerald-500"
                    onChange={() => onToggleExclude(rowKey)}
                  />
                </td>
              ) : null}
              <td className="min-w-0 break-words px-2 py-2 capitalize text-primary">{item.kind}</td>
              <td className="min-w-0 break-words px-2 py-2 text-primary">
                {item.slab ?? "—"}
                {outlier ? (
                  <span className="ml-1 rounded bg-rose-500/15 px-1 text-[9px] text-rose-300">outlier</span>
                ) : null}
              </td>
              <td className="min-w-0 break-words px-2 py-2 font-mono text-primary tabular-nums">{formatUsd(item.priceUsd)}</td>
              <td className="min-w-0 break-words px-2 py-2 text-muted">{formatDate(item.observedAt)}</td>
              <td className="min-w-0 break-words px-2 py-2 text-muted">{item.source ?? "—"}</td>
              <td className="min-w-0 break-words px-2 py-2 text-primary">
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[2.75rem] items-center gap-1 text-base text-accent touch-manipulation sm:min-h-0 sm:text-xs hover:underline"
                  >
                    Source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                )}
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      {hidden > 0 ? (
        <p className="border-t border-border-subtle px-3 py-2 text-[11px] text-muted">+{hidden} more in session export.</p>
      ) : null}
    </div>
  );
}
