import {
  bestCatalogUsd,
  hasParseableCatalogPrices,
} from "@/lib/market/catalog-price-utils";
import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { listPokemonSetsVintageFirst } from "@/lib/market/build-live-market-ticker";
import { resolvedCatalogMomentumPct } from "@/lib/market/poketrace/momentum";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type MarketDailyBriefSetRow = {
  id: string;
  name: string;
  code: string | null;
  releaseDate: string | null;
  year: string | null;
};

export type MarketDailyBriefChaseRow = {
  setName: string;
  setCode: string | null;
  cardName: string;
  cardNumber: string | null;
  rarity: string | null;
  priceUsd: number | null;
  momentumPct: number | null;
};

export type MarketDailyBriefContext = {
  todayUtc: string;
  recentReleases: MarketDailyBriefSetRow[];
  upcomingReleases: MarketDailyBriefSetRow[];
  hotSets: MarketDailyBriefSetRow[];
  chaseCards: MarketDailyBriefChaseRow[];
  anchorLines: string[];
};

function setRowFromSummary(set: {
  id: string;
  name: string;
  code: string | null;
  releaseDate: string | null;
  year: string | null;
}): MarketDailyBriefSetRow {
  return {
    id: set.id,
    name: set.name,
    code: set.code,
    releaseDate: set.releaseDate,
    year: set.year,
  };
}

async function topChaseForSet(
  set: MarketDailyBriefSetRow,
): Promise<MarketDailyBriefChaseRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const filters: Array<{ column: "set_code" | "set_name"; value: string }> = [];
  if (set.code?.trim()) filters.push({ column: "set_code", value: set.code.trim() });
  if (set.id?.trim() && set.id !== set.code) {
    filters.push({ column: "set_code", value: set.id.trim() });
  }
  if (set.name?.trim()) filters.push({ column: "set_name", value: set.name.trim() });

  for (const filter of filters) {
    const { data, error } = await supabase
      .from("tcg_catalog_cards")
      .select("name,card_number,rarity,prices_json")
      .eq("franchise", "pokemon")
      .eq(filter.column, filter.value)
      .not("prices_json", "is", null)
      .limit(80);
    if (error || !data?.length) continue;

    let best: MarketDailyBriefChaseRow | null = null;
    for (const row of data) {
      const pricesJson = row.prices_json as Record<string, unknown> | null;
      if (!hasParseableCatalogPrices(pricesJson)) continue;
      const prices = parseCatalogPriceSnapshot(pricesJson);
      const priceUsd = bestCatalogUsd(prices);
      const momentumPct = resolvedCatalogMomentumPct(prices);
      const candidate: MarketDailyBriefChaseRow = {
        setName: set.name,
        setCode: set.code,
        cardName: String(row.name),
        cardNumber: row.card_number ? String(row.card_number) : null,
        rarity: row.rarity ? String(row.rarity) : null,
        priceUsd,
        momentumPct,
      };
      if (
        !best ||
        (candidate.priceUsd ?? 0) > (best.priceUsd ?? 0) ||
        ((candidate.priceUsd ?? 0) === (best.priceUsd ?? 0) &&
          Math.abs(candidate.momentumPct ?? 0) > Math.abs(best.momentumPct ?? 0))
      ) {
        best = candidate;
      }
    }
    if (best) return best;
  }
  return null;
}

function formatUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

export function buildMarketDailyBriefAnchorLines(ctx: MarketDailyBriefContext): string[] {
  const lines: string[] = [];
  lines.push(`PGT catalog anchor · ${ctx.todayUtc} (UTC)`);

  if (ctx.recentReleases.length) {
    lines.push(
      "Recent EN catalog releases: " +
        ctx.recentReleases
          .slice(0, 6)
          .map((s) => `${s.name}${s.releaseDate ? ` (${s.releaseDate})` : ""}`)
          .join("; "),
    );
  }
  if (ctx.upcomingReleases.length) {
    lines.push(
      "Upcoming / future-dated catalog sets: " +
        ctx.upcomingReleases
          .slice(0, 4)
          .map((s) => `${s.name}${s.releaseDate ? ` (${s.releaseDate})` : ""}`)
          .join("; "),
    );
  }
  if (ctx.chaseCards.length) {
    lines.push(
      "PGT chase / top-value signals: " +
        ctx.chaseCards
          .map((c) => {
            const mom =
              c.momentumPct != null && Math.abs(c.momentumPct) >= 0.5
                ? ` · ${c.momentumPct > 0 ? "+" : ""}${c.momentumPct.toFixed(1)}% 7d`
                : "";
            return `${c.cardName} (${c.setName}) REF ${formatUsd(c.priceUsd)}${mom}`;
          })
          .join("; "),
    );
  }
  return lines;
}

export async function buildMarketDailyBriefContext(
  deskDate?: string,
): Promise<MarketDailyBriefContext> {
  const todayUtc = deskDate ?? new Date().toISOString().slice(0, 10);
  const allSets = await listPokemonSetsVintageFirst();
  const withDates = allSets.filter((s) => s.releaseDate);

  const recentReleases = withDates
    .filter((s) => s.releaseDate! <= todayUtc)
    .slice(-8)
    .reverse()
    .map(setRowFromSummary);

  const upcomingReleases = withDates
    .filter((s) => s.releaseDate! > todayUtc)
    .slice(0, 6)
    .map(setRowFromSummary);

  const hotCandidateSets = recentReleases.slice(0, 4);
  const chaseCards: MarketDailyBriefChaseRow[] = [];
  for (const set of hotCandidateSets) {
    const chase = await topChaseForSet(set);
    if (chase) chaseCards.push(chase);
  }

  chaseCards.sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0));

  const hotSets = hotCandidateSets.sort((a, b) => {
    const aMom = chaseCards.find((c) => c.setName === a.name)?.momentumPct ?? 0;
    const bMom = chaseCards.find((c) => c.setName === b.name)?.momentumPct ?? 0;
    return Math.abs(bMom) - Math.abs(aMom);
  });

  const ctx: MarketDailyBriefContext = {
    todayUtc,
    recentReleases,
    upcomingReleases,
    hotSets,
    chaseCards: chaseCards.slice(0, 6),
    anchorLines: [],
  };
  ctx.anchorLines = buildMarketDailyBriefAnchorLines(ctx);
  return ctx;
}
