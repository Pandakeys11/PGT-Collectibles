"use client";

import { cn } from "@/lib/cn";

export function CompanionStatBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "hunger" | "energy" | "mood";
}) {
  const color =
    tone === "hunger"
      ? "bg-energy-fire-2"
      : tone === "energy"
        ? "bg-energy-electric-2"
        : "bg-energy-fairy-2";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wide text-faint">
        <span>{label}</span>
        <span className="font-mono text-muted">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel-raised/80">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
