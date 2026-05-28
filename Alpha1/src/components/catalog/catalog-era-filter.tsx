"use client";

import { SET_ERA_DESCRIPTION, SET_ERA_LABEL, SET_ERA_ORDER, type SetEraId } from "@/lib/pokedex/set-era";
import { cn } from "@/lib/cn";

/** Legacy PGT vault era pills — Vintage / Mid-Era / Modern. */
export function CatalogEraFilter({
  value,
  onChange,
  embedded = false,
  className,
}: {
  value: SetEraId;
  onChange: (era: SetEraId) => void;
  embedded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sc-catalog-era-filter grid shrink-0 grid-cols-3 gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-0.5",
        embedded ? "lg:min-w-[11.5rem] lg:gap-1 lg:p-1" : "gap-1 p-1",
        className,
      )}
      role="group"
      aria-label="Filter sets by era"
    >
      {SET_ERA_ORDER.map((era) => {
        const active = value === era;
        return (
          <button
            key={era}
            type="button"
            title={SET_ERA_DESCRIPTION[era]}
            aria-pressed={active}
            onClick={() => onChange(era)}
            className={cn(
              "rounded-lg px-1 py-1.5 text-center font-semibold leading-tight transition touch-manipulation",
              embedded ? "text-[10px] lg:px-2 lg:py-2 lg:text-xs" : "px-1.5 py-2 text-[10px] sm:px-2 sm:text-xs",
              active
                ? "border border-amber-400/35 bg-amber-400/95 text-[#080a0e] shadow-sm"
                : "border border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-200",
            )}
          >
            {SET_ERA_LABEL[era]}
          </button>
        );
      })}
    </div>
  );
}
