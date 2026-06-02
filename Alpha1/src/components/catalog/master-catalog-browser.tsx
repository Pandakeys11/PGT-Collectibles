"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PokedexBrowser } from "@/components/pokedex/pokedex-browser";
import { GenericCatalogBrowser } from "@/components/catalog/generic-catalog-browser";
import type { CatalogFranchiseId, CatalogFranchiseMeta } from "@/lib/catalog/catalog-types";
import { defaultFranchiseMeta, sortFranchiseMetas } from "@/lib/catalog/franchise-registry";
import type { CatalogScanPrefill } from "@/lib/scan/catalog-bridge";
import { fetchCatalogJson, readCatalogCache } from "@/lib/catalog/catalog-fetch-cache";
import { cn } from "@/lib/cn";

const TAB_ORDER: CatalogFranchiseId[] = [
  "pokemon",
  "magic",
  "yugioh",
  "onepiece",
  "lorcana",
  "dragonball",
  "sports",
];

const TAB_SHORT: Partial<Record<CatalogFranchiseId, string>> = {
  pokemon: "Pokémon",
  magic: "MTG",
  yugioh: "YGO",
  onepiece: "OP",
  lorcana: "Lorcana",
  dragonball: "DBS",
  sports: "Sports",
};

export function MasterCatalogBrowser({
  scanTargetPath,
  onScanPrefill,
  embedded = false,
  initialFranchise = "pokemon",
}: {
  scanTargetPath?: string;
  onScanPrefill?: (prefill: CatalogScanPrefill) => void;
  embedded?: boolean;
  initialFranchise?: CatalogFranchiseId;
}) {
  const [franchise, setFranchise] = useState<CatalogFranchiseId>(initialFranchise);
  const [metas, setMetas] = useState<CatalogFranchiseMeta[]>(
    TAB_ORDER.map((id) => defaultFranchiseMeta(id)),
  );
  const [loadingMeta, setLoadingMeta] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const url = "/api/catalog/franchises";
    const cached = readCatalogCache<{ franchises?: CatalogFranchiseMeta[] }>(url);
    if (cached?.franchises?.length) {
      setMetas(sortFranchiseMetas(cached.franchises));
      setLoadingMeta(false);
    }
    void fetchCatalogJson<{ franchises?: CatalogFranchiseMeta[] }>(url)
      .then((body) => {
        if (cancelled) return;
        const list = body.franchises ?? [];
        setMetas(sortFranchiseMetas(list.length ? list : TAB_ORDER.map((id) => defaultFranchiseMeta(id))));
      })
      .catch(() => {
        if (!cancelled && !cached?.franchises?.length) {
          setMetas(TAB_ORDER.map((id) => defaultFranchiseMeta(id)));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeMeta = metas.find((m) => m.id === franchise) ?? defaultFranchiseMeta(franchise);

  return (
    <div className={cn("min-w-0", embedded ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-3")}>
      <div
        className={cn(
          embedded && "sc-master-catalog-chrome sticky top-0 z-20 -mx-0.5 rounded-lg bg-[rgb(8,10,14)]/95 px-0.5 py-1 backdrop-blur-md",
        )}
      >
        <div
          role="tablist"
          aria-label="Catalog franchise"
          className="flex gap-1 overflow-x-auto rounded-lg border border-white/10 bg-black/35 p-1 scanner-chat-scrollbar [scrollbar-width:thin]"
        >
          {TAB_ORDER.filter((id) => {
            if (id === "dragonball") {
              const count = metas.find((m) => m.id === id)?.cardCountEstimate;
              return count != null && count > 0;
            }
            return true;
          }).map((id) => {
            const meta = metas.find((m) => m.id === id) ?? defaultFranchiseMeta(id);
            const active = franchise === id;
            const short = TAB_SHORT[id] ?? meta.label.split(" ")[0];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFranchise(id)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition touch-manipulation sm:px-3 sm:text-[11px]",
                  embedded && "lg:px-3.5 lg:py-2 lg:text-xs",
                  active
                    ? "bg-brand-gold text-inverse shadow-sm shadow-brand-gold/20"
                    : "text-muted hover:bg-subtle/50 hover:text-primary",
                )}
              >
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{meta.label}</span>
                {meta.cardCountEstimate != null && meta.cardCountEstimate > 0 ? (
                  <span className="ml-1 font-mono text-[9px] opacity-75">
                    {(meta.cardCountEstimate / 1000).toFixed(0)}k
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {loadingMeta ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading catalog…
          </p>
        ) : (
          <p className="mt-1.5 truncate text-[10px] text-slate-500">
            {activeMeta.label}
            {activeMeta.cardCountEstimate && activeMeta.cardCountEstimate > 0
              ? ` · ~${activeMeta.cardCountEstimate.toLocaleString()} cards`
              : ""}
          </p>
        )}
      </div>

      <div className={cn(embedded && "flex min-h-0 flex-1 flex-col")}>
      {franchise === "pokemon" ? (
        <PokedexBrowser
          embedded={embedded}
          scanTargetPath={scanTargetPath}
          onScanPrefill={onScanPrefill}
        />
      ) : franchise === "sports" ? (
        <div className="rounded-lg border border-dashed border-white/12 bg-white/[0.02] px-3 py-5 text-center">
          <p className="text-[11px] leading-relaxed text-slate-400">
            Sports catalog browse is coming soon. Use scan + market hubs for player cards today, or
            switch to Pokémon / TCG tabs for set browse.
          </p>
        </div>
      ) : (
        <GenericCatalogBrowser
          franchise={franchise}
          meta={activeMeta}
          embedded={embedded}
          scanTargetPath={scanTargetPath}
          onScanPrefill={onScanPrefill}
        />
      )}
      </div>
    </div>
  );
}
