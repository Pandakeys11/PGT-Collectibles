"use client";

import {
  BINDER_THEME_LABEL,
  BINDER_THEME_ORDER,
  BINDER_THEME_SWATCH,
  type BinderThemeId,
} from "@/lib/catalog/binder-theme";
import { cn } from "@/lib/cn";

export function CatalogBinderThemePicker({
  theme,
  onThemeChange,
  className,
}: {
  theme: BinderThemeId;
  onThemeChange: (theme: BinderThemeId) => void;
  className?: string;
}) {
  return (
    <div className={cn("sc-binder-theme-picker flex items-center gap-2", className)}>
      <span className="hidden text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:inline">
        Page
      </span>
      <div
        className="flex items-center gap-1 rounded-lg border border-white/8 bg-black/25 p-0.5"
        role="radiogroup"
        aria-label="Binder page color"
      >
        {BINDER_THEME_ORDER.map((id) => {
          const active = theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${BINDER_THEME_LABEL[id]} binder pages`}
              title={`${BINDER_THEME_LABEL[id]} pages`}
              onClick={() => onThemeChange(id)}
              className={cn(
                "sc-binder-theme-picker__swatch relative h-6 w-6 rounded-md border transition touch-manipulation",
                active
                  ? "border-white/50 ring-2 ring-emerald-400/55 ring-offset-1 ring-offset-[rgb(8,10,14)]"
                  : "border-white/15 hover:border-white/35",
              )}
              style={{ backgroundColor: BINDER_THEME_SWATCH[id] }}
            >
              <span className="sr-only">{BINDER_THEME_LABEL[id]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
