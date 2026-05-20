"use client";

import { CompanionPanel, type CompanionPanelProps } from "@/components/companion/companion-panel";

export function CompanionDock(props: Omit<CompanionPanelProps, "layout">) {
  return <CompanionPanel layout="sidebar" {...props} />;
}
