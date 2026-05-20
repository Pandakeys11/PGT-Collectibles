"use client";

import { useCallback, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function CatalogFocusGrid<T>({
  items,
  getKey,
  className,
  renderItem,
}: {
  items: T[];
  getKey: (item: T) => string;
  className?: string;
  renderItem: (item: T, state: { focused: boolean; dimmed: boolean }) => ReactNode;
}) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const clearFocus = useCallback(() => setFocusedKey(null), []);

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
        className,
      )}
      onMouseLeave={clearFocus}
    >
      {items.map((item) => {
        const key = getKey(item);
        const focused = focusedKey === key;
        const dimmed = focusedKey != null && !focused;

        return (
          <div
            key={key}
            className={cn(
              "transition-[transform,opacity,filter] duration-300 ease-out motion-reduce:transition-none",
              dimmed && "scale-[0.97] opacity-55 blur-[1.5px] motion-reduce:opacity-80 motion-reduce:blur-none",
              focused && "relative z-[1] scale-[1.02] motion-reduce:scale-100",
            )}
            onMouseEnter={() => setFocusedKey(key)}
            onFocus={() => setFocusedKey(key)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setFocusedKey((current) => (current === key ? null : current));
              }
            }}
          >
            {renderItem(item, { focused, dimmed })}
          </div>
        );
      })}
    </div>
  );
}
