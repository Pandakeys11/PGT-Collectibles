"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import type { CatalogFranchiseMeta } from "@/lib/catalog/catalog-types";

type HealthTone = "ok" | "warn" | "bad" | "unknown";

function ageDays(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

function classifyHealth(franchises: CatalogFranchiseMeta[]): {
  tone: HealthTone;
  label: string;
  title: string;
} {
  const byId = new Map(franchises.map((f) => [f.id, f]));

  const focus = ["pokemon", "magic", "yugioh", "onepiece", "lorcana"] as const;
  const lines: string[] = [];

  const rank: Record<HealthTone, number> = { ok: 0, unknown: 1, warn: 2, bad: 3 };
  let worst: HealthTone = "unknown";
  let worstRank = rank[worst];

  for (const id of focus) {
    const meta = byId.get(id);
    if (!meta) continue;
    const count = meta.cardCountEstimate ?? null;
    const days = ageDays(meta.lastSyncedAt ?? null);

    let tone: HealthTone = "unknown";
    if (count != null && count <= 0) tone = "bad";
    else if (days == null) tone = count != null && count > 0 ? "warn" : "unknown";
    else if (days >= 14) tone = "bad";
    else if (days >= 5) tone = "warn";
    else tone = "ok";

    const tRank = rank[tone];
    if (tRank > worstRank) {
      worst = tone;
      worstRank = tRank;
    }

    const syncText =
      days == null ? "never/unknown" : days === 0 ? "today" : `${days}d ago`;
    const countText = count == null ? "?" : count.toLocaleString();
    lines.push(`${meta.label}: ${countText} cards · synced ${syncText}`);
  }

  let label = "Catalog status";
  switch (worst) {
    case "ok":
      label = "Catalog OK";
      break;
    case "warn":
      label = "Catalog needs sync";
      break;
    case "bad":
      label = "Catalog missing/stale";
      break;
    default:
      label = "Catalog status";
  }

  return {
    tone: worst,
    label,
    title: lines.join("\n"),
  };
}

export function CatalogHealthPill({ className }: { className?: string }) {
  const [franchises, setFranchises] = useState<CatalogFranchiseMeta[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/catalog/franchises")
      .then(async (r) => {
        const body = (await r.json()) as { franchises?: CatalogFranchiseMeta[]; error?: string };
        if (!r.ok) throw new Error(body.error ?? "Failed to load catalog franchises");
        return body.franchises ?? [];
      })
      .then((list) => {
        if (cancelled) return;
        setFailed(false);
        setFranchises(list);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setFranchises(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const health = useMemo(() => {
    if (failed) return { tone: "bad" as const, label: "Catalog API down", title: "Failed to load /api/catalog/franchises" };
    if (!franchises) return { tone: "unknown" as const, label: "Catalog status", title: "Loading…" };
    return classifyHealth(franchises);
  }, [failed, franchises]);

  const toneClass =
    health.tone === "ok"
      ? "border-success/30 bg-success/10 text-success"
      : health.tone === "warn"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
        : health.tone === "bad"
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-white/10 bg-white/5 text-muted";

  return (
    <div
      className={cn(
        "hidden rounded-full border px-2 py-1 text-[10px] font-semibold sm:flex",
        toneClass,
        className,
      )}
      title={health.title}
      aria-label={health.label}
    >
      {health.label}
    </div>
  );
}

