"use client";

import {
  CATALOG_FINISH_TAB_LABELS,
  CATALOG_FINISH_TAB_ORDER,
  printingPresetTabs,
  type CatalogFinishBucketId,
  type PrintingPresetId,
} from "@/lib/pokedex/set-catalog-config";
import { RARITY_TAB_LABELS, RARITY_TAB_ORDER, type RarityBucketId } from "@/lib/pokedex/rarity-buckets";
import { cn } from "@/lib/cn";

const TABLIST_CLASS =
  "flex gap-1 overflow-x-auto rounded-full border border-border-subtle bg-panel-raised/35 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const TAB_BTN_CLASS =
  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition touch-manipulation";

export function CatalogRarityFilterTabs(props: {
  value: RarityBucketId;
  counts: Record<RarityBucketId, number> | null;
  countsLoading: boolean;
  onChange: (bucket: RarityBucketId) => void;
}) {
  const { value, counts, countsLoading, onChange } = props;
  return (
    <div
      role="tablist"
      aria-label="Filter cards by rarity"
      className={TABLIST_CLASS}
    >
      {RARITY_TAB_ORDER.map((id) => {
        const active = value === id;
        const n = counts?.[id];
        const countLabel = countsLoading && n === undefined ? "…" : (n ?? "—");
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              TAB_BTN_CLASS,
              active ? "bg-accent text-canvas shadow-sm" : "text-muted hover:bg-panel-raised hover:text-primary",
            )}
          >
            {RARITY_TAB_LABELS[id]} ({countLabel})
          </button>
        );
      })}
    </div>
  );
}

export function CatalogFinishFilterTabs(props: {
  value: CatalogFinishBucketId;
  onChange: (finish: CatalogFinishBucketId) => void;
}) {
  const { value, onChange } = props;
  return (
    <div role="tablist" aria-label="Rare finish filter" className={TABLIST_CLASS}>
      {CATALOG_FINISH_TAB_ORDER.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              TAB_BTN_CLASS,
              active ? "bg-accent text-canvas shadow-sm" : "text-muted hover:bg-panel-raised hover:text-primary",
            )}
          >
            {CATALOG_FINISH_TAB_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}

export function CatalogPrintingPresetTabs(props: {
  options: NonNullable<ReturnType<typeof printingPresetTabs>>;
  value: PrintingPresetId;
  onChange: (preset: PrintingPresetId) => void;
}) {
  const { options, value, onChange } = props;
  return (
    <div role="tablist" aria-label="Print run marketplace bias" className={TABLIST_CLASS}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.hint}
            onClick={() => onChange(opt.id)}
            className={cn(
              TAB_BTN_CLASS,
              active ? "bg-accent text-canvas shadow-sm" : "text-muted hover:bg-panel-raised hover:text-primary",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
