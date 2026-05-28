"use client";

import { useEffect, useRef, useState } from "react";
import type { ExtractedCard, MarketEvidence } from "@/lib/scan/schemas";

export type PremiumGradeBriefState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      markdown: string;
      model: string;
      provider: "gemini" | "openrouter";
      todayUtc: string;
    }
  | { status: "unconfigured"; message: string }
  | { status: "error"; message: string };

function cardCacheKey(
  specimenId: string | null | undefined,
  card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps">,
  marketAsOf?: string | null,
): string {
  return [
    specimenId ?? "none",
    card.name,
    card.set,
    card.number,
    card.year,
    card.rarity,
    card.printStamps,
    marketAsOf ?? "",
  ]
    .filter(Boolean)
    .join("|");
}

const briefCache = new Map<string, PremiumGradeBriefState>();

export function usePremiumGradeBrief(
  card: Pick<ExtractedCard, "name" | "set" | "number" | "year" | "rarity" | "printStamps"> | null,
  options?: {
    specimenId?: string | null;
    /** Re-fetch when enrich finishes (pass enriching flag from parent). */
    marketAsOf?: string | null;
    sessionEvidence?: MarketEvidence[];
    enabled?: boolean;
  },
): PremiumGradeBriefState {
  const [state, setState] = useState<PremiumGradeBriefState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled || !card?.name?.trim()) {
      setState({ status: "idle" });
      return;
    }

    const key = cardCacheKey(options?.specimenId, card, options?.marketAsOf);
    const cached = briefCache.get(key);
    if (cached?.status === "ready") {
      setState(cached);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState({ status: "loading" });

    void (async () => {
      try {
        const res = await fetch("/api/scan/premium-grade-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card,
            sessionEvidence: options?.sessionEvidence?.slice(0, 24) ?? [],
          }),
          signal: ac.signal,
        });
        const data = (await res.json()) as {
          markdown?: string;
          model?: string;
          provider?: "gemini" | "openrouter";
          todayUtc?: string;
          configured?: boolean;
          error?: string;
        };

        if (ac.signal.aborted) return;

        if (!res.ok || data.error) {
          if (data.configured === false) {
            setState({
              status: "unconfigured",
              message:
                data.error ?? "Add GEMINI_API_KEY for automatic premium grade research.",
            });
          } else {
            setState({
              status: "error",
              message: data.error ?? "Premium grade research failed.",
            });
          }
          return;
        }

        const markdown = data.markdown?.trim() ?? "";
        if (!markdown) {
          setState({ status: "error", message: "No web brief returned." });
          return;
        }

        const ready: PremiumGradeBriefState = {
          status: "ready",
          markdown,
          model: data.model ?? "",
          provider: data.provider ?? "gemini",
          todayUtc: data.todayUtc ?? new Date().toISOString().slice(0, 10),
        };
        briefCache.set(key, ready);
        setState(ready);
      } catch (err) {
        if (ac.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Premium grade research failed.",
        });
      }
    })();

    return () => {
      ac.abort();
    };
  }, [
    enabled,
    card,
    card?.name,
    card?.set,
    card?.number,
    card?.year,
    card?.rarity,
    card?.printStamps,
    options?.specimenId,
    options?.marketAsOf,
    options?.sessionEvidence,
    options?.sessionEvidence?.length,
  ]);

  return state;
}
