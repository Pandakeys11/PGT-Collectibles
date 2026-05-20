"use client";

import type { ReactNode } from "react";
import { GlobalShell } from "@/components/layout/global-shell";

export function AppRouteShell({ children }: { children: ReactNode }) {
  return <GlobalShell>{children}</GlobalShell>;
}
