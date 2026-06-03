import {
  buildMarketDailyBriefContext,
  type MarketDailyBriefContext,
} from "@/lib/market/build-market-daily-brief-context";
import { buildMarketDailyBriefUserMessage } from "@/lib/market/market-daily-brief-prompt";
import {
  getMarketDailyBriefEditionKey,
  getMarketDailyBriefNextRefreshAt,
  getMarketDailyBriefRefreshHourUtc,
} from "@/lib/market/market-daily-brief-schedule";
import { runLiquidAskWebBriefWithBudget } from "@/lib/scanner-chat/liquid-ask-web-brief-runner";

export type MarketDailyBriefPayload = {
  ready: boolean;
  /** Desk date shown in the brief (edition key). */
  todayUtc: string;
  /** Same as todayUtc — explicit edition id for client cache invalidation. */
  editionKey: string;
  /** When the next desk edition becomes active (ISO). */
  nextRefreshAt: string;
  refreshHourUtc: number;
  researchedAt: string;
  markdown: string;
  provider: "gemini" | "groq" | "openrouter" | "pgt-only" | null;
  model: string | null;
  hotSetNames: string[];
  error?: string;
};

function fallbackMarkdown(ctx: MarketDailyBriefContext): string {
  const lines = [
    `**Today's desk**`,
    `PGT catalog snapshot for ${ctx.todayUtc}. Live web research is temporarily unavailable — anchors below are from the master catalog.`,
    ``,
    `**Fresh on shelves**`,
  ];
  if (ctx.recentReleases.length) {
    for (const s of ctx.recentReleases.slice(0, 6)) {
      lines.push(
        `- **${s.name}**${s.releaseDate ? ` · ${s.releaseDate}` : ""}${s.code ? ` · ${s.code}` : ""}`,
      );
    }
  } else {
    lines.push(`- No dated recent releases in catalog.`);
  }
  lines.push(``, `**Coming soon**`);
  if (ctx.upcomingReleases.length) {
    for (const s of ctx.upcomingReleases) {
      lines.push(`- **${s.name}** · ${s.releaseDate ?? "TBA"}`);
    }
  } else {
    lines.push(`- No future-dated sets in catalog yet.`);
  }
  lines.push(``, `**Chase watch** (PGT REFERENCE)`);
  if (ctx.chaseCards.length) {
    for (const c of ctx.chaseCards) {
      const price =
        c.priceUsd != null ? `$${Math.round(c.priceUsd).toLocaleString()}` : "—";
      const mom =
        c.momentumPct != null && Math.abs(c.momentumPct) >= 0.5
          ? ` · ${c.momentumPct > 0 ? "+" : ""}${c.momentumPct.toFixed(1)}% 7d`
          : "";
      lines.push(
        `- **${c.cardName}** (${c.setName}) · REFERENCE ${price}${mom}`,
      );
    }
  } else {
    lines.push(`- Run catalog FMV backfill for chase signals.`);
  }
  lines.push(
    ``,
    `**Your move**`,
    `Open the platform links below for live sold comps while web brief refreshes.`,
    ``,
    `_Catalog-only desk — verify prices on TCGPlayer, eBay sold, and Cardmarket before transacting._`,
  );
  return lines.join("\n");
}

function scheduleFields(deskDate: string): Pick<
  MarketDailyBriefPayload,
  "editionKey" | "nextRefreshAt" | "refreshHourUtc"
> {
  return {
    editionKey: deskDate,
    nextRefreshAt: getMarketDailyBriefNextRefreshAt(),
    refreshHourUtc: getMarketDailyBriefRefreshHourUtc(),
  };
}

export async function runMarketDailyBrief(
  deskDate?: string,
): Promise<MarketDailyBriefPayload> {
  const editionKey = deskDate ?? getMarketDailyBriefEditionKey();
  const researchedAt = new Date().toISOString();
  let ctx: MarketDailyBriefContext;
  try {
    ctx = await buildMarketDailyBriefContext(editionKey);
  } catch (err) {
    return {
      ready: false,
      todayUtc: editionKey,
      researchedAt,
      markdown: "",
      provider: null,
      model: null,
      hotSetNames: [],
      ...scheduleFields(editionKey),
      error: err instanceof Error ? err.message : "Failed to load catalog context",
    };
  }

  const hotSetNames = ctx.hotSets.map((s) => s.name).slice(0, 3);
  const message = buildMarketDailyBriefUserMessage(ctx);
  const brief = await runLiquidAskWebBriefWithBudget(message, ctx.todayUtc, {
    allowPro: false,
  });

  if (brief?.markdown) {
    return {
      ready: true,
      todayUtc: ctx.todayUtc,
      researchedAt,
      markdown: brief.markdown,
      provider: brief.provider,
      model: brief.model,
      hotSetNames,
      ...scheduleFields(editionKey),
    };
  }

  return {
    ready: true,
    todayUtc: ctx.todayUtc,
    researchedAt,
    markdown: fallbackMarkdown(ctx),
    provider: "pgt-only",
    model: null,
    hotSetNames,
    ...scheduleFields(editionKey),
    error: "Web brief unavailable — showing catalog desk",
  };
}
