"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  formatSavedAskingUsd,
  formatSavedCardMetaLine,
  formatSavedCardTitle,
  formatSavedGradedLine,
  getSavedAskingUsd,
} from "@/lib/scan/specimen-present";

export type MasterSavedCardRow = {
  id: string;
  name: string;
  printed_name: string | null;
  language: string | null;
  set_name: string | null;
  card_number: string | null;
  year: string | null;
  rarity: string | null;
  print_stamps: string | null;
  grader: string | null;
  grade: string | null;
  cert: string | null;
  catalog_id: string | null;
  catalog_confidence: number | null;
  market_snapshot_json: {
    fairValueUsd?: number | null;
    fairValueBasis?: string | null;
    askingUsd?: number | null;
    marketEvidence?: unknown[];
    marketSourceLinks?: Array<{ url?: string; label?: string; source?: string }>;
  } | null;
  raw_extraction_json: unknown;
  created_at: string;
  updated_at: string | null;
};

type EditableKey =
  | "name"
  | "set_name"
  | "card_number"
  | "year"
  | "rarity"
  | "print_stamps"
  | "grader"
  | "grade"
  | "cert";

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function confidence(value: number | null | undefined) {
  if (value == null) return "-";
  return `${Math.round(value * 100)}%`;
}

export function MasterExtractedList({
  initialCards,
  variant = "default",
}: {
  initialCards: MasterSavedCardRow[];
  variant?: "default" | "neo";
}) {
  const [cards, setCards] = useState(initialCards);
  const [expandedId, setExpandedId] = useState<string | null>(initialCards[0]?.id ?? null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const neo = variant === "neo";

  const totals = useMemo(() => {
    const fmv = cards.reduce((sum, card) => sum + (card.market_snapshot_json?.fairValueUsd ?? 0), 0);
    const asking = cards.reduce((sum, card) => sum + (getSavedAskingUsd(card) ?? 0), 0);
    const cataloged = cards.filter((card) => card.catalog_id).length;
    return { fmv, asking, cataloged };
  }, [cards]);

  const patchCard = (id: string, key: EditableKey, value: string) => {
    setCards((current) =>
      current.map((card) =>
        card.id === id
          ? {
              ...card,
              [key]: key === "name" ? value : value.trim() ? value : null,
            }
          : card,
      ),
    );
  };

  const saveCard = async (card: MasterSavedCardRow) => {
    setSavingId(card.id);
    setStatus(null);
    try {
      const payload: Pick<MasterSavedCardRow, EditableKey> = {
        name: card.name,
        set_name: card.set_name,
        card_number: card.card_number,
        year: card.year,
        rarity: card.rarity,
        print_stamps: card.print_stamps,
        grader: card.grader,
        grade: card.grade,
        cert: card.cert,
      };
      const response = await fetch(`/api/saved/cards/${encodeURIComponent(card.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => ({}))) as {
        card?: MasterSavedCardRow;
        error?: string;
      };
      if (!response.ok || !body.card) throw new Error(body.error ?? "Unable to save card");
      setCards((current) => current.map((item) => (item.id === card.id ? body.card! : item)));
      setStatus(`Saved ${body.card.name}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to save card");
    } finally {
      setSavingId(null);
    }
  };

  if (cards.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed p-10 text-center",
          neo ? "border-white/[0.12] bg-[#070b10] text-slate-500" : "border-border-subtle/80 text-muted",
        )}
      >
        <p className="text-sm">Saved cards will appear here after a scan session is saved.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.045]" : "border-border-subtle bg-panel-raised/40")}>
          <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Saved cards</p>
          <p className={cn("mt-1 font-mono text-2xl", neo ? "text-cyan-100" : "text-primary")}>{cards.length}</p>
        </div>
        <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.045]" : "border-border-subtle bg-panel-raised/40")}>
          <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Catalog matched</p>
          <p className={cn("mt-1 font-mono text-2xl", neo ? "text-amber-100" : "text-primary")}>{cards.length ? confidence(totals.cataloged / cards.length) : "-"}</p>
        </div>
        <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.045]" : "border-border-subtle bg-panel-raised/40")}>
          <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Sticker / ask</p>
          <p className={cn("mt-1 font-mono text-2xl", neo ? "text-amber-100" : "text-primary")}>
            {formatMoney(totals.asking)}
          </p>
        </div>
        <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.045]" : "border-border-subtle bg-panel-raised/40")}>
          <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Saved FMV</p>
          <p className={cn("mt-1 font-mono text-2xl", neo ? "text-emerald-100" : "text-accent")}>{formatMoney(totals.fmv)}</p>
        </div>
      </div>

      {status ? (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            neo ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100" : "border-border-subtle bg-panel-raised/40 text-muted",
          )}
        >
          {status}
        </p>
      ) : null}

      <div className={cn("overflow-hidden rounded-lg border", neo ? "border-white/[0.08] bg-[#070b10]" : "border-border-subtle")}>
        <div
          className={cn(
            "hidden grid-cols-[2rem_minmax(11rem,1.1fr)_minmax(7rem,0.65fr)_minmax(7rem,0.65fr)_4rem_4.5rem_4.5rem_4rem] gap-2 border-b px-3 py-2 text-[10px] font-semibold uppercase lg:grid",
            neo ? "border-white/[0.08] bg-white/[0.04] text-slate-500" : "border-border-subtle bg-panel-raised/60 text-desk-label",
          )}
        >
          <span />
          <span>Card</span>
          <span>Set / No.</span>
          <span>Grade / Cert</span>
          <span>Ask</span>
          <span>FMV</span>
          <span>Saved</span>
        </div>

        <div className={cn("divide-y", neo ? "divide-white/[0.07]" : "divide-border-subtle/70")}>
          {cards.map((card) => {
            const expanded = expandedId === card.id;
            const fmv = card.market_snapshot_json?.fairValueUsd ?? null;
            const evidenceCount = card.market_snapshot_json?.marketEvidence?.length ?? 0;
            const sourceLinks = card.market_snapshot_json?.marketSourceLinks ?? [];
            return (
              <div key={card.id} className={cn(neo ? "bg-white/[0.025]" : "bg-panel/40")}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : card.id)}
                  className={cn(
                    "grid w-full gap-3 px-3 py-3 text-left transition lg:grid-cols-[2rem_minmax(11rem,1.1fr)_minmax(7rem,0.65fr)_minmax(7rem,0.65fr)_4rem_4.5rem_4.5rem_4rem] lg:gap-2",
                    neo ? "hover:bg-white/[0.055]" : "hover:bg-panel-raised/35",
                  )}
                >
                  <span className={cn("hidden lg:block", neo ? "text-slate-500" : "text-muted")}>
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={cn("lg:hidden", neo ? "text-slate-500" : "text-muted")}>
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </span>
                      <span className={cn("block min-w-0 truncate font-medium", neo ? "text-slate-100" : "text-primary")}>
                        {formatSavedCardTitle(card)}
                      </span>
                    </span>
                    <span className={cn("mt-0.5 block truncate text-xs", neo ? "text-slate-500" : "text-muted")}>
                      {formatSavedCardMetaLine(card)}
                    </span>
                  </span>
                  <span className={cn("flex min-w-0 items-center justify-between gap-3 truncate text-sm lg:block", neo ? "text-slate-400" : "text-muted")}>
                    <span className={cn("text-[10px] font-semibold uppercase lg:hidden", neo ? "text-slate-600" : "text-desk-label")}>Set</span>
                    {[card.set_name, card.card_number].filter(Boolean).join(" / ") || "-"}
                  </span>
                  <span className={cn("flex min-w-0 items-center justify-between gap-3 truncate font-mono text-xs lg:block", neo ? "text-amber-100/95" : "text-primary")}>
                    <span className={cn("font-sans text-[10px] font-semibold uppercase lg:hidden", neo ? "text-slate-600" : "text-desk-label")}>
                      Grade
                    </span>
                    {formatSavedGradedLine(card)}
                  </span>
                  <span className={cn("flex items-center justify-between gap-3 font-mono text-xs lg:block", neo ? "text-amber-100" : "text-primary")}>
                    <span className={cn("font-sans text-[10px] font-semibold uppercase lg:hidden", neo ? "text-slate-600" : "text-desk-label")}>Ask</span>
                    {formatSavedAskingUsd(card)}
                  </span>
                  <span className={cn("flex items-center justify-between gap-3 font-mono text-sm lg:block", neo ? "text-emerald-100" : "text-accent")}>
                    <span className={cn("font-sans text-[10px] font-semibold uppercase lg:hidden", neo ? "text-slate-600" : "text-desk-label")}>FMV</span>
                    {formatMoney(fmv)}
                  </span>
                  <span className={cn("flex items-center justify-between gap-3 text-sm lg:block", neo ? "text-slate-500" : "text-muted")}>
                    <span className={cn("text-[10px] font-semibold uppercase lg:hidden", neo ? "text-slate-600" : "text-desk-label")}>Saved</span>
                    {formatDate(card.created_at)}
                  </span>
                </button>

                {expanded ? (
                  <div className={cn("border-t p-4", neo ? "border-white/[0.08] bg-black/20" : "border-border-subtle/60 bg-canvas/20")}>
                    <div className="grid gap-3 lg:grid-cols-3">
                      {([
                        ["name", "Name"],
                        ["set_name", "Set"],
                        ["card_number", "Card #"],
                        ["year", "Year"],
                        ["rarity", "Rarity"],
                        ["print_stamps", "Print / stamps"],
                        ["grader", "Grader"],
                        ["grade", "Grade"],
                        ["cert", "Cert"],
                      ] as Array<[EditableKey, string]>).map(([key, label]) => (
                        <label key={key} className="block">
                          <span className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>{label}</span>
                          <input
                            value={(card[key] ?? "") as string}
                            onChange={(event) => patchCard(card.id, key, event.target.value)}
                            className={cn(
                              "mt-1 h-10 w-full rounded-md border px-3 text-sm outline-none transition",
                              neo
                                ? "border-white/10 bg-[#070b10] text-slate-100 focus:border-cyan-300/45"
                                : "border-border-subtle bg-panel-raised/50 text-primary focus:border-accent/50",
                            )}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-4">
                      <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.035]" : "border-border-subtle bg-panel-raised/35")}>
                        <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Catalog</p>
                        <p className={cn("mt-1 font-mono text-sm", neo ? "text-slate-100" : "text-primary")}>{card.catalog_id ?? "-"}</p>
                        <p className={cn("mt-1 text-xs", neo ? "text-slate-500" : "text-muted")}>{confidence(card.catalog_confidence)}</p>
                      </div>
                      <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.035]" : "border-border-subtle bg-panel-raised/35")}>
                        <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Market basis</p>
                        <p className={cn("mt-1 text-sm", neo ? "text-slate-100" : "text-primary")}>{card.market_snapshot_json?.fairValueBasis ?? "-"}</p>
                      </div>
                      <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.035]" : "border-border-subtle bg-panel-raised/35")}>
                        <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Evidence rows</p>
                        <p className={cn("mt-1 font-mono text-sm", neo ? "text-slate-100" : "text-primary")}>{evidenceCount}</p>
                      </div>
                      <div className={cn("rounded-lg border p-3", neo ? "border-white/[0.08] bg-white/[0.035]" : "border-border-subtle bg-panel-raised/35")}>
                        <p className={cn("text-[10px] font-semibold uppercase", neo ? "text-slate-500" : "text-desk-label")}>Sources</p>
                        <p className={cn("mt-1 font-mono text-sm", neo ? "text-slate-100" : "text-primary")}>{sourceLinks.length}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" onClick={() => void saveCard(card)} disabled={savingId === card.id}>
                        {savingId === card.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save edits
                      </Button>
                      {sourceLinks[0]?.url ? (
                        <Button type="button" size="sm" variant="secondary" asChild>
                          <a href={sourceLinks[0].url} target="_blank" rel="noreferrer">
                            Source hub
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : null}
                      <span className={cn("text-xs text-muted", savingId === card.id && "text-accent")}>
                        Updated {formatDate(card.updated_at)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
