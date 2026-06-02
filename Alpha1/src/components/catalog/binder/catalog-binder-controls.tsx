"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogBinderThemePicker } from "@/components/catalog/binder/catalog-binder-theme-picker";
import type { BinderThemeId } from "@/lib/catalog/binder-theme";
import { cn } from "@/lib/cn";

export function CatalogBinderControls({
  navLabel,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  expanded,
  onToggleExpand,
  mobilePage = false,
  binderTheme,
  onBinderThemeChange,
  className,
}: {
  navLabel: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Single-page mobile binder (one 3×5 page visible). */
  mobilePage?: boolean;
  binderTheme: BinderThemeId;
  onBinderThemeChange: (theme: BinderThemeId) => void;
  className?: string;
}) {
  return (
    <div className={cn("sc-binder-toolbar", className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {mobilePage ? `Binder page · ${navLabel}` : `3×5 binder · ${navLabel}`}
        </p>
        <CatalogBinderThemePicker theme={binderTheme} onThemeChange={onBinderThemeChange} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-0.5 px-2"
          disabled={prevDisabled}
          onClick={onPrev}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <span className="min-w-[5.5rem] text-center text-[11px] font-medium tabular-nums text-slate-300">
          {navLabel}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-0.5 px-2"
          disabled={nextDisabled}
          onClick={onNext}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8 px-0"
          onClick={onToggleExpand}
          aria-label={expanded ? "Exit fullscreen binder" : "Expand binder fullscreen"}
        >
          {expanded ? (
            <Minimize2 className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}
