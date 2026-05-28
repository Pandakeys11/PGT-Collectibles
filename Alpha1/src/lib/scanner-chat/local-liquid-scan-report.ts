import { buildSessionBrief } from "@/lib/scan/narration-brief";
import { displayPrintVersion } from "@/lib/scan/display-print-edition";
import type { ScanCardContext } from "@/lib/scan/schemas";
import type { LiquidAskResearch } from "@/lib/scanner-chat/liquid-ask-types";
import type { ScanSummary } from "@/lib/scanner-chat/types";
import { NARRATION_TODAY_ISO } from "@/lib/scan/narration-brief";

function usd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function cardLine(ctx: ScanCardContext): string {
  const grade =
    ctx.lane === "graded" && ctx.extraction && typeof ctx.extraction === "object"
      ? [ctx.extraction.grader, ctx.extraction.grade].filter(Boolean).join(" ")
      : "";
  const print = displayPrintVersion(
    {
      printStamps:
        typeof ctx.extraction?.printStamps === "string" ? ctx.extraction.printStamps : undefined,
      details: typeof ctx.extraction?.details === "string" ? ctx.extraction.details : undefined,
    },
    ctx.variantLabel,
  );
  const meta = [ctx.setName, ctx.cardNumber, print || null].filter(Boolean).join(" · ");
  return grade ? `**${ctx.name}** (${grade})${meta ? ` — ${meta}` : ""}` : `**${ctx.name}**${meta ? ` — ${meta}` : ""}`;
}

function soldCount(ctx: ScanCardContext): number {
  return ctx.marketEvidence.filter((e) => e.kind === "sold").length;
}

/**
 * Deterministic session intelligence report from enrich data — no LLM required.
 * Used when all text providers are quota-blocked.
 */
export function buildLocalLiquidScanReport(args: {
  contexts: ScanCardContext[];
  summary: ScanSummary;
  research?: LiquidAskResearch | null;
}): string {
  const { contexts, summary, research } = args;
  const graded = contexts.filter((c) => c.lane === "graded").length;
  const raw = contexts.length - graded;
  const verified = contexts.filter((c) => c.catalogIdentityStatus === "confirmed").length;
  const review = contexts.filter(
    (c) => c.catalogIdentityStatus === "ambiguous" || c.verificationStatus !== "verified",
  ).length;
  const byFmv = [...contexts].sort((a, b) => (b.fairValueUsd ?? 0) - (a.fairValueUsd ?? 0));
  const top = byFmv[0];
  const blockers = [
    ...new Set(
      contexts.flatMap((c) => c.blockers).filter((b) => b.trim().length > 0),
    ),
  ].slice(0, 8);

  const sections: string[] = [];

  sections.push(`## Executive summary`);
  sections.push(
    [
      `This upload has **${summary.totalDetected}** card${summary.totalDetected === 1 ? "" : "s"} (${graded} graded, ${raw} raw) with **${verified}** catalog-confirmed identities and **${review}** row(s) needing review.`,
      summary.estimatedTotal > 0
        ? `Session FMV total (comps in enrich pass): **${usd(summary.estimatedTotal)}**.`
        : `Session FMV is still thin — confirm identities and re-sync enrich on key rows.`,
      top
        ? `Largest in-session FMV: **${top.name}** at **${usd(top.fairValueUsd)}**.`
        : "",
      `*Generated ${NARRATION_TODAY_ISO} from session enrich data (local desk mode — cloud LLM providers were unavailable).*`,
    ]
      .filter(Boolean)
      .join(" "),
  );

  sections.push(`## The upload at a glance`);
  const setNames = [...new Set(contexts.map((c) => c.setName).filter(Boolean))].slice(0, 10);
  sections.push(
    [
      `- **Eras / sets:** ${setNames.length ? setNames.join(", ") : "mixed or unset"}`,
      `- **Graded vs raw:** ${graded} graded · ${raw} raw`,
      `- **Catalog health:** ${verified} confirmed · ${review} review/ambiguous`,
      `- **Session FMV:** ${usd(summary.estimatedTotal)}`,
      summary.bestHit
        ? `- **Top hit:** ${summary.bestHit.name} · ${usd(summary.bestHit.fmv)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  sections.push(`## Market sentiment & collector vibe`);
  if (research?.webBrief?.trim()) {
    sections.push(research.webBrief.trim());
  } else {
    sections.push(
      [
        `Live web-sentiment LLM was unavailable (provider quotas). Use platform hub links in the scan for macro trends.`,
        research?.dataCoverage?.ebaySoldCount
          ? `Automated research captured **${research.dataCoverage.ebaySoldCount}** eBay sold highlight(s) for this query.`
          : `No automated eBay sold rows for the batch query — rely on per-card session comps below.`,
      ].join(" "),
    );
  }

  sections.push(`## What's hot — narratives in play`);
  sections.push(
    [
      `1. **Graded liquidity** — PSA/BGS/CGC slabs with cert-matched comps still command premiums when population is tight.`,
      `2. **Vintage print runs** — 1st Edition, Shadowless, and Unlimited must stay separated; do not blend comps across stamps.`,
      `3. **Modern chase & alt art** — illustration rares and special prints move on hype cycles and pull rates.`,
      `4. **Raw vs slab spread** — raw FMV from TCGPlayer/Cardmarket vs slab FMV from sold auction prints can diverge sharply.`,
    ].join("\n"),
  );

  sections.push(`## Your cards on those waves`);
  for (const ctx of byFmv.slice(0, 12)) {
    const brief = buildSessionBrief(ctx);
    const sold = soldCount(ctx);
    sections.push(
      [
        `### ${cardLine(ctx)}`,
        brief.summary,
        sold > 0
          ? `**FMV:** ${usd(ctx.fairValueUsd)} · **${sold}** sold comp(s) in-session.`
          : `**FMV:** ${usd(ctx.fairValueUsd)} · thin comps — open Sold/Listed hubs.`,
        brief.marketSnapshot ? brief.marketSnapshot : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  sections.push(`## Standouts & sleepers`);
  sections.push(`### Standouts`);
  for (const ctx of byFmv.filter((c) => (c.fairValueUsd ?? 0) > 0).slice(0, 5)) {
    sections.push(
      `- ${cardLine(ctx)} — FMV **${usd(ctx.fairValueUsd)}** · ${soldCount(ctx)} sold comp(s)`,
    );
  }
  if (!byFmv.some((c) => (c.fairValueUsd ?? 0) > 0)) {
    sections.push(`- No priced FMV rows yet — run enrich or confirm catalog matches.`);
  }

  sections.push(`### Sleepers / contrarian`);
  const thin = byFmv.filter((c) => soldCount(c) === 0 && (c.fairValueUsd ?? 0) > 0).slice(0, 5);
  if (thin.length) {
    for (const ctx of thin) {
      sections.push(`- ${cardLine(ctx)} — FMV shown but few sold comps; verify print run and grade.`);
    }
  } else {
    sections.push(`- No obvious under-comped rows in-session; focus on edition/blocker flags below.`);
  }

  sections.push(`## Slab & grade desk notes`);
  const slabs = contexts.filter((c) => c.lane === "graded");
  if (!slabs.length) {
    sections.push(`No graded slabs in this upload.`);
  } else {
    for (const ctx of slabs.slice(0, 10)) {
      const brief = buildSessionBrief(ctx);
      sections.push(`- ${cardLine(ctx)}\n  ${brief.valuation.replace(/\n/g, "\n  ")}`);
    }
  }

  sections.push(`## Honest risks before you transact`);
  if (blockers.length) {
    for (const b of blockers) sections.push(`- ${b}`);
  } else {
    sections.push(`- No session blockers flagged — still verify print run on vintage raw holos.`);
  }

  sections.push(`## What I'd do next`);
  sections.push(
    [
      `1. Re-sync enrich on any row with FMV "—" or ambiguous catalog.`,
      `2. Confirm **1st Ed / Shadowless / Unlimited** stamps before listing vintage raw.`,
      `3. Open **eBay sold** and **Card Ladder** hub links for top FMV cards.`,
      `4. Export the scan sheet and attach comps screenshots for buyers.`,
      `5. When LLM providers are restored, re-run the session report for narrative sentiment.`,
    ].join("\n"),
  );

  sections.push(`## Confidence`);
  const avgConf =
    contexts.length > 0
      ? Math.round(
          (contexts.reduce((s, c) => s + c.catalogConfidence, 0) / contexts.length) * 100,
        )
      : 0;
  sections.push(
    [
      `Identity: **${verified}/${contexts.length}** confirmed catalog · avg catalog confidence **${avgConf}%**.`,
      `Market: comps are from the **enrich pass** embedded in this session (${NARRATION_TODAY_ISO}).`,
      review > 0
        ? `**${review}** card(s) need manual review before transacting.`
        : `No ambiguous rows flagged at session level.`,
    ].join(" "),
  );

  return sections.join("\n\n");
}
