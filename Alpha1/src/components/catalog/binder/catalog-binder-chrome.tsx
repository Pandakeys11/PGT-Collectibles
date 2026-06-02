"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Rarity / finish filters stacked above binder prev-next controls. */
export function CatalogBinderChrome({
  filterChrome,
  children,
  className,
}: {
  filterChrome?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  if (!filterChrome) {
    return <>{children}</>;
  }

  return (
    <div className={cn("sc-binder-chrome shrink-0", className)}>
      <div className="sc-binder-chrome__filters">{filterChrome}</div>
      <div className="sc-binder-chrome__nav">{children}</div>
    </div>
  );
}
