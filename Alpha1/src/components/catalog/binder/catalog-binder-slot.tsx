"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function CatalogBinderSlot({
  empty = false,
  children,
  className,
}: {
  empty?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sc-binder-slot", empty && "sc-binder-slot--empty", className)}>
      <div className="sc-binder-slot__sleeve">{children}</div>
    </div>
  );
}
