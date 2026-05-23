import { buildSessionBrief } from "@/lib/scan/narration-brief";
import { buildNarrationLlmContext } from "@/lib/scan/narration-context";
import type { ScanCardContext } from "@/lib/scan/schemas";
import {
  buildLiquidVaultSystemPrompt,
} from "@/lib/scanner-chat/liquid-vault-guru-rules";

const MAX_SPECIMENS_IN_SESSION = 12;

function stripBriefMd(text: string): string {
  return text.replace(/\*\*/g, "").trim();
}

/** Deterministic desk brief for Liquid Ask context. */
function briefDigestForContext(context: ScanCardContext): Record<string, string | string[]> {
  const brief = buildSessionBrief(context);
  return {
    summary: stripBriefMd(brief.summary),
    marketSnapshot: brief.marketSnapshot ? stripBriefMd(brief.marketSnapshot) : "",
    compAnalysis: brief.compAnalysis ? stripBriefMd(brief.compAnalysis) : "",
    valuation: stripBriefMd(brief.valuation),
    nextChecks: brief.nextChecks.map(stripBriefMd).slice(0, 6),
  };
}

function marketRecencyNote(
  contexts: ScanCardContext[],
  researchJson?: string | null,
): string | null {
  if (researchJson) {
    try {
      const pack = JSON.parse(researchJson) as { researchedAt?: string; todayUtc?: string };
      if (pack.researchedAt) {
        return `Live research pack fetched at question time (UTC): ${pack.researchedAt}. Prefer comps and sources in the research pack for current market answers; session JSON is supporting context.`;
      }
    } catch {
      /* ignore */
    }
    return "A live research pack was fetched at question time — use it for current comps, certs, and prices.";
  }
  const dates = contexts
    .map((c) => c.marketAsOf)
    .filter((d): d is string => Boolean(d?.trim()));
  if (dates.length === 0) return null;
  const latest = dates.sort().at(-1)!;
  return `Session market evidence latest capture (UTC): ${latest}. No live research pack for this turn — describe staleness if citing session comps only.`;
}

export function buildLiquidChatPayload({
  message,
  history,
  contexts,
  focusSpecimenId,
  researchJson,
}: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  contexts: ScanCardContext[];
  focusSpecimenId?: string | null;
  researchJson?: string | null;
}): {
  system: string;
  user: string;
  hasScanData: boolean;
  marketAsOf: string | null;
} {
  const transcript = history
    .map((turn) => `${turn.role}: ${turn.content}`)
    .concat(`user: ${message}`)
    .join("\n");

  const recency = marketRecencyNote(contexts, researchJson);

  const focus =
    focusSpecimenId != null
      ? contexts.find((c) => c.specimenId === focusSpecimenId) ?? null
      : null;

  if (focus) {
    const compact = buildNarrationLlmContext(focus);
    const digest = briefDigestForContext(focus);
    return {
      hasScanData: true,
      marketAsOf: focus.marketAsOf ?? null,
      system: buildLiquidVaultSystemPrompt("focused"),
      user: [
        recency ? `Recency:\n${recency}\n` : "",
        researchJson ? `Live research pack (${researchJson.length} chars, use for comps/certs/population):\n${researchJson}\n` : "",
        `Desk brief (verified session synthesis):\n${JSON.stringify(digest)}`,
        `Focused card context:\n${JSON.stringify(compact)}`,
        `Conversation:\n${transcript}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  }

  if (contexts.length > 0) {
    const sessionCards = contexts.slice(0, MAX_SPECIMENS_IN_SESSION).map((ctx, index) => ({
      index: index + 1,
      specimenId: ctx.specimenId,
      marketAsOf: ctx.marketAsOf,
      briefDigest: briefDigestForContext(ctx),
      ...buildNarrationLlmContext(ctx),
    }));
    const totals = {
      cardCount: contexts.length,
      verifiedFmvUsd: contexts.reduce((sum, c) => sum + (c.fairValueUsd ?? 0), 0),
      verifiedCount: contexts.filter((c) => c.verificationStatus === "verified").length,
      catalogConfirmed: contexts.filter((c) => c.catalogIdentityStatus === "confirmed").length,
    };
    const latestAsOf = contexts.map((c) => c.marketAsOf).filter(Boolean).sort().at(-1) ?? null;
    return {
      hasScanData: true,
      marketAsOf: latestAsOf,
      system: buildLiquidVaultSystemPrompt("session"),
      user: [
        recency ? `Recency:\n${recency}\n` : "",
        researchJson ? `Live research pack:\n${researchJson}\n` : "",
        `Session totals:\n${JSON.stringify(totals)}`,
        `Session cards:\n${JSON.stringify(sessionCards)}`,
        `Conversation:\n${transcript}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    };
  }

  let researchBlock = "";
  if (researchJson) {
    try {
      const pack = JSON.parse(researchJson) as {
        webBrief?: string | null;
        liveResearchUsed?: boolean;
      };
      if (pack.webBrief?.trim()) {
        researchBlock = `Open web brief (primary — answer from this):\n${pack.webBrief.trim()}\n\nStructured research JSON:\n${researchJson}`;
      } else {
        researchBlock = `Live research pack:\n${researchJson}`;
      }
      if (pack.liveResearchUsed) {
        researchBlock = `liveResearchUsed: true\n${researchBlock}`;
      }
    } catch {
      researchBlock = `Live research pack:\n${researchJson}`;
    }
  }

  return {
    hasScanData: false,
    marketAsOf: null,
    system: buildLiquidVaultSystemPrompt("general"),
    user: researchBlock ? `${researchBlock}\n\nConversation:\n${transcript}` : transcript,
  };
}
