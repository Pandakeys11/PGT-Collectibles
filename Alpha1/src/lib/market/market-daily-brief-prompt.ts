import type { MarketDailyBriefContext } from "@/lib/market/build-market-daily-brief-context";

export function buildMarketDailyBriefUserMessage(ctx: MarketDailyBriefContext): string {
  return `Today's date (UTC): ${ctx.todayUtc}

Task: Write the **PGT Daily TCG Desk** — a collector's morning newspaper for Pokémon TCG. This appears in the idle Market Intelligence rail when no card is selected.

Use live web search for: official Pokémon TCG release news, announced/upcoming English & Japanese sets, preorder/street dates, sealed product MSRP when known, and current market chatter for hot sets and chase cards.

PGT first-party catalog anchors (REFERENCE — do not invent prices beyond these unless web search confirms with source type):
${ctx.anchorLines.map((l) => `- ${l}`).join("\n")}

Required markdown sections (use these exact bold headers):
**Today's desk** — 2–3 sentence outlook dated ${ctx.todayUtc}
**Fresh on shelves** — recent releases & what's shipping now
**Coming soon** — announced/upcoming sets with dates when known
**Hot sets now** — sets with momentum, sealed demand, or collector focus
**Chase watch** — top chase cards with price bands (raw + graded where known); label each as SOLD, ACTIVE (ask), or REFERENCE
**Market read** — sentiment, liquidity, vintage vs modern split if relevant
**Your move** — practical buy / hold / wait guidance for collectors today
**Sources** — bullet list of real URLs you relied on (official Pokémon, TCGPlayer news, reputable hobby outlets)

Voice: calm desk analyst — like a trusted show dealer + market researcher. No clickbait.
End with one-line disclaimer: web-sourced indicative intel — verify before transacting.`;
}
