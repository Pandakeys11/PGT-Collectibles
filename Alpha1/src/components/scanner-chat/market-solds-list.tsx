"use client";

import { ExternalLink } from "lucide-react";
import { buildEbayHubForCard } from "@/lib/market/sources";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";
import type { buildEbayGradeHubs, buildHubUrlMap } from "@/lib/market/sources";
import { MarketEvidenceFeed } from "@/components/scanner-chat/market-evidence-row";
import { cn } from "@/lib/cn";

export function MarketSoldsList({
  items,
  hubMap,
  ebayGradeHubs,
  excludedKeys,
  outlierKeys,
  onToggleExclude,
  maxRows = 10,
  card,
  className,
}: {
  items: MarketEvidence[];
  hubMap: ReturnType<typeof buildHubUrlMap>;
  ebayGradeHubs: ReturnType<typeof buildEbayGradeHubs>;
  card?: ExtractedCard | null;
  excludedKeys?: Set<string>;
  outlierKeys?: Set<string>;
  onToggleExclude?: (key: string) => void;
  maxRows?: number;
  className?: string;
}) {
  if (items.length === 0) {
    const ebaySold = card ? buildEbayHubForCard(card).sold : null;
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-slate-500",
          className,
        )}
      >
        <p>No sold comps in this filter yet.</p>
        {ebaySold ? (
          <a
            href={ebaySold}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-400 hover:underline"
          >
            Open eBay sold search for this card
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : (
          <p className="mt-1">Run enrich or use Shop &amp; research links above.</p>
        )}
      </div>
    );
  }

  return (
    <MarketEvidenceFeed
      items={items}
      hubMap={hubMap}
      ebayGradeHubs={ebayGradeHubs}
      card={card}
      excludedKeys={excludedKeys}
      outlierKeys={outlierKeys}
      onToggleExclude={onToggleExclude}
      maxRows={maxRows}
      className={className}
    />
  );
}
