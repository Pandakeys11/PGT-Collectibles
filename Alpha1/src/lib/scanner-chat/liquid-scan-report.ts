import { buildSessionBrief } from "@/lib/scan/narration-brief";
import { buildNarrationLlmContext } from "@/lib/scan/narration-context";
import type { ScanCardContext } from "@/lib/scan/schemas";
import type { ScanSummary } from "@/lib/scanner-chat/types";
import { NARRATION_TODAY_ISO } from "@/lib/scan/narration-brief";
import { MARKET_MASTER_ACCURACY, MARKET_MASTER_IDENTITY } from "@/lib/scanner-chat/market-master-guard-rails";

/** Internal trigger — not shown to the user as their message. */
export const SCAN_REPORT_INTERNAL_MESSAGE =
  "Generate the full post-scan session intelligence report for this upload.";

export const LIQUID_SCAN_REPORT_MAX_TOKENS = 4_096;

export const LIQUID_SCAN_REPORT_SYSTEM = `Today's date: ${NARRATION_TODAY_ISO} (UTC).

${MARKET_MASTER_IDENTITY}

# Role — PGT Liquid Scan Session Intelligence

You are the **PGT Liquid Scan** desk editor writing a **session intelligence report** after a completed multi-card upload. Magazine-quality debrief grounded in extracted cards and live research — not a generic FAQ.

${MARKET_MASTER_ACCURACY}

# Data rules (strict)

1. **Session JSON + desk brief digests** are authoritative for each scanned card (names, sets, grades, FMV, comps, verification, sticker vs FMV).
2. **Live research pack** (when present) informs **current market sentiment**, hype cycles, and macro collector vibe — cite it for "what's hot right now."
3. **Never invent** prices, sale dates, populations, or URLs not in session or research.
4. Separate **sticker price** (dealer tag on slab) from **fair market value** (comps-derived). Label SOLD vs ACTIVE vs REFERENCE when citing comps.
5. Vintage Wizards: never blend **1st Edition**, **Shadowless**, and **Unlimited** comps.
6. End with **## Confidence** — session-wide identity/market/grading certainty and what needs manual review.

# Required report structure (markdown)

Use these exact section headers (## level):

## Executive summary
3–5 sentences: what this upload is, total scale, headline opportunity, biggest risk.

## The upload at a glance
Bullet inventory themes: era mix (Base/Fossil/Neo/modern), graded vs raw ratio, verification health, approximate session FMV total (from session totals only).

## Market sentiment & collector vibe
Current Pokémon TCG (and relevant TCG) mood: retail vs secondary, graded vs raw appetite, auction vs BIN, language/regional notes if relevant. Write like you're explaining the **room temperature** to a seller at a show.

## What's hot — narratives in play
2–4 active market narratives (e.g. vintage holo liquidity, PSA 10 premium compression, Japanese gym era, modern chase reprints). Tie each to **why** collectors care in ${NARRATION_TODAY_ISO.slice(0, 4)}.

## Your cards on those waves
For **each narrative above**, name specific cards **from this scan** that fit or fight the trend. Use exact card names and grades from session JSON. If none fit, say so.

## Standouts & sleepers
- **Standouts**: highest FMV or strongest comp support in-session.
- **Sleepers / contrarian**: cards that look under-stickered, thin comps, or edition ambiguity — with what to verify.

## Slab & grade desk notes
Graded rows only: population hints, cert/registry notes, grade-matched comp quality. Flag NA certs or registry mismatches.

## Honest risks before you transact
Counterfeit/edition/blocker callouts from session blockers. Items needing manual confirm.

## What I'd do next
Numbered action list: confirm identities, pull comps, list vs hold, re-scan, export — practical and short.

# Style

- Long-form prose between sections; use bullets inside sections where helpful.
- **Bold** card names and dollar amounts that appear in session JSON.
- No engagement bait; no investment guarantees.
- If research pack is thin, say so and lean on session comps while noting sentiment may be directional only.`;

function stripBriefMd(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

function briefDigest(context: ScanCardContext): Record<string, string | string[]> {
  const brief = buildSessionBrief(context);
  return {
    summary: stripBriefMd(brief.summary),
    marketSnapshot: brief.marketSnapshot ? stripBriefMd(brief.marketSnapshot) : "",
    compAnalysis: brief.compAnalysis ? stripBriefMd(brief.compAnalysis) : "",
    valuation: stripBriefMd(brief.valuation),
    nextChecks: brief.nextChecks.map(stripBriefMd).slice(0, 5),
  };
}

/** Web research query for sentiment / hype (fed to liquid-ask research). */
export function buildScanReportResearchQuery(
  contexts: ScanCardContext[],
  summary: ScanSummary,
): string {
  const names = contexts
    .map((c) => {
      const grade =
        c.lane === "graded" && c.extraction && typeof c.extraction === "object"
          ? [c.extraction.grader, c.extraction.grade].filter(Boolean).join(" ")
          : "";
      return grade ? `${c.name} (${grade})` : c.name;
    })
    .slice(0, 14);

  const sets = [...new Set(contexts.map((c) => c.setName).filter(Boolean))].slice(0, 8);
  const graded = contexts.filter((c) => c.lane === "graded").length;
  const raw = contexts.length - graded;

  return [
    `Pokémon TCG collector market sentiment, hype, and narrative trends as of ${NARRATION_TODAY_ISO}.`,
    `This scan batch has ${summary.totalDetected} cards (${graded} graded, ${raw} raw).`,
    sets.length ? `Sets/eras represented: ${sets.join(", ")}.` : "",
    `Cards: ${names.join("; ")}.`,
    `Cover: current market vibe, what collectors are chasing, vintage vs modern liquidity, graded premium trends,`,
    `and which of these specific cards align with active hype or trade against it.`,
    `Use recent public market reporting — eBay sold trends, auction houses, community buzz — no invented prices.`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildScanReportSessionDigest(
  contexts: ScanCardContext[],
  summary: ScanSummary,
): Record<string, unknown> {
  const cards = contexts.slice(0, 24).map((ctx, index) => ({
    index: index + 1,
    specimenId: ctx.specimenId,
    briefDigest: briefDigest(ctx),
    ...buildNarrationLlmContext(ctx),
  }));

  return {
    todayUtc: NARRATION_TODAY_ISO,
    totals: {
      cardCount: summary.totalDetected,
      verifiedCatalogMatches: summary.highConfidence,
      needsReview: summary.needsReview,
      sessionFmvUsd: summary.estimatedTotal,
      bestHit: summary.bestHit ?? null,
    },
    cards,
  };
}

export function buildLiquidScanReportUserPrompt(args: {
  contexts: ScanCardContext[];
  summary: ScanSummary;
  researchJson?: string | null;
}): string {
  const digest = buildScanReportSessionDigest(args.contexts, args.summary);
  return [
    `Write the full session intelligence report for this completed Liquid Scan.`,
    args.researchJson
      ? `Live market sentiment research pack:\n${args.researchJson}\n`
      : "No live sentiment research pack — use session comps and general market knowledge with explicit uncertainty on macro trends.",
    `Session digest:\n${JSON.stringify(digest)}`,
    `Instruction: Follow the required section headers in the system prompt. Every card named in "Your cards on those waves" must appear in the session digest.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
