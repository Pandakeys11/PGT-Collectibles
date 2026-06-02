"use client";

import { useCallback, useState, type ReactNode } from "react";
import { CATALOG_CARD_GRID_DEFAULT } from "@/lib/catalog/catalog-grid-layout";
import { cn } from "@/lib/cn";

export function CatalogFocusGrid<T>({
  items,
  getKey,
  gridClassName = CATALOG_CARD_GRID_DEFAULT,
  className,
  renderItem,
}: {
  items: T[];
  getKey: (item: T) => string;
  /** Replaces default grid column template (e.g. CATALOG_CARD_GRID_4X4). */
  gridClassName?: string;
  className?: string;
  renderItem: (item: T, state: { focused: boolean; dimmed: boolean; index: number }) => ReactNode;
}) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const clearFocus = useCallback(() => setFocusedKey(null), []);

  return (
    <div
      className={cn("sc-catalog-card-grid grid", gridClassName, className)}
      onMouseLeave={clearFocus}
    >
      {items.map((item, index) => {
        const key = getKey(item);
        const focused = focusedKey === key;
        const dimmed = focusedKey != null && !focused;

        return (
          <div
            key={key}
            className={cn(
              "transition-[transform,opacity,filter] duration-300 ease-out motion-reduce:transition-none",
              dimmed && "scale-[0.98] opacity-60 blur-[0.5px] motion-reduce:opacity-85 motion-reduce:blur-none",
              focused && "relative z-[1] scale-[1.015] motion-reduce:scale-100",
            )}
            onMouseEnter={() => setFocusedKey(key)}
            onFocus={() => setFocusedKey(key)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setFocusedKey((current) => (current === key ? null : current));
              }
            }}
          >
            {renderItem(item, { focused, dimmed, index })}
          </div>
        );
      })}
    </div>
  );
}
