"use client";

import {
  BookOpen,
  Camera,
  LineChart,
  ListChecks,
  ScanSearch,
  Sparkles,
} from "lucide-react";
import type { CompanionState } from "@/lib/companion/schemas";
import { cn } from "@/lib/cn";

const QUEST_ICONS: Record<string, typeof Sparkles> = {
  daily_login: Sparkles,
  daily_scan_session: Camera,
  daily_market_intel: LineChart,
  daily_catalog_lock: BookOpen,
  daily_scan_three: ScanSearch,
  daily_feed: Sparkles,
  daily_care: Sparkles,
  weekly_train: Sparkles,
  weekly_battle: Sparkles,
  weekly_scan_fifteen: ScanSearch,
  usage_scans: Camera,
};

function windowLabel(window: string) {
  if (window === "daily") return "Daily";
  if (window === "weekly") return "Weekly";
  return "League";
}

export function CompanionQuestBoard({
  tasks,
  busy,
  isMobile,
  onClaim,
}: {
  tasks: CompanionState["tasks"];
  busy: boolean;
  isMobile?: boolean;
  onClaim: (taskId: string) => void;
}) {
  const groups = [
    { key: "daily", label: "Daily quests", items: tasks.filter((t) => t.window === "daily") },
    { key: "weekly", label: "Weekly quests", items: tasks.filter((t) => t.window === "weekly") },
    { key: "usage", label: "League quests", items: tasks.filter((t) => t.window === "usage") },
  ].filter((g) => g.items.length > 0);

  const readyCount = tasks.filter((t) => t.complete && !t.claimed).length;

  return (
    <div className={cn("space-y-3", isMobile && "space-y-4")}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ListChecks className={cn("text-slate-500", isMobile ? "h-4 w-4" : "h-3.5 w-3.5")} />
          <p className={cn("font-semibold uppercase text-slate-500", isMobile ? "text-xs" : "text-[9px]")}>
            Partner quests
          </p>
        </div>
        {readyCount > 0 ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-200">
            {readyCount} ready
          </span>
        ) : null}
      </div>

      {groups.map((group) => (
        <div key={group.key} className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">{group.label}</p>
          {group.items.map((task) => {
            const Icon = QUEST_ICONS[task.id] ?? Sparkles;
            const pct = Math.round((task.progress / Math.max(1, task.goal)) * 100);
            return (
              <div
                key={task.id}
                className={cn(
                  "rounded-lg border border-white/[0.07] bg-[#05080c]",
                  isMobile ? "px-3 py-3" : "px-2.5 py-2",
                  task.complete && !task.claimed && "border-emerald-400/20",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03]">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-slate-300", isMobile ? "text-sm" : "text-[10px] leading-snug")}>
                        {task.label}
                      </p>
                      <span className="shrink-0 text-[8px] font-semibold uppercase text-slate-600">
                        {windowLabel(task.window)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          task.complete ? "bg-emerald-400/70" : "bg-slate-500/60",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className={cn("mt-1 font-mono text-slate-600", isMobile ? "text-xs" : "text-[9px]")}>
                      {task.progress}/{task.goal} · +{task.rewardXp} XP
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || !task.complete || task.claimed}
                    onClick={() => onClaim(task.id)}
                    className={cn(
                      "shrink-0 touch-manipulation rounded-md px-2.5 py-1.5 font-bold uppercase transition active:scale-[0.98]",
                      isMobile ? "text-xs" : "text-[9px]",
                      task.claimed
                        ? "border border-white/10 text-slate-600"
                        : task.complete
                          ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                          : "border border-white/10 text-slate-500",
                    )}
                  >
                    {task.claimed ? "Done" : task.complete ? "Claim" : "—"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
