import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { readSetIngestCursor } from "@/lib/pgt-registry/market-ingest-set-queue";

const CURSOR_SOURCE_ID = "pokemontcg.io";
const REPORT_WINDOW_HOURS = 6;

export type NightlyPlatformReport = {
  generatedAt: string;
  windowHours: number;
  marketIngest: {
    setCode: string | null;
    setIndex: number;
    cardOffset: number;
    updatedAt: string | null;
  };
  overnight: {
    compsIngested: number;
    popSnapshots: number;
    catalogCards: number;
    pokemonSets: number;
  };
  catalogSync: unknown;
};

export async function buildNightlyPlatformReport(catalogSyncResults?: unknown): Promise<NightlyPlatformReport> {
  const generatedAt = new Date().toISOString();
  const since = new Date(Date.now() - REPORT_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const cursor = await readSetIngestCursor();

  let compsIngested = 0;
  let popSnapshots = 0;
  let catalogCards = 0;
  let pokemonSets = 0;
  let updatedAt: string | null = null;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseAdmin();

    const [comps, pops, cards, sets, source] = await Promise.all([
      supabase
        .from("pgt_market_comps")
        .select("id", { count: "exact", head: true })
        .eq("franchise", "pokemon")
        .gte("ingested_at", since),
      supabase
        .from("pgt_population_snapshots")
        .select("id", { count: "exact", head: true })
        .eq("franchise", "pokemon")
        .gte("captured_at", since),
      supabase
        .from("tcg_catalog_cards")
        .select("catalog_id", { count: "exact", head: true })
        .eq("franchise", "pokemon"),
      supabase
        .from("tcg_catalog_sets")
        .select("code", { count: "exact", head: true })
        .eq("franchise", "pokemon"),
      supabase
        .from("tcg_catalog_sources")
        .select("raw_json")
        .eq("id", CURSOR_SOURCE_ID)
        .maybeSingle(),
    ]);

    compsIngested = comps.count ?? 0;
    popSnapshots = pops.count ?? 0;
    catalogCards = cards.count ?? 0;
    pokemonSets = sets.count ?? 0;
    const raw = (source.data?.raw_json as Record<string, unknown>) ?? {};
    updatedAt =
      typeof raw.marketIngestSetUpdatedAt === "string" ? raw.marketIngestSetUpdatedAt : null;
  }

  return {
    generatedAt,
    windowHours: REPORT_WINDOW_HOURS,
    marketIngest: {
      setCode: cursor.setCode,
      setIndex: cursor.setIndex,
      cardOffset: cursor.cardOffset,
      updatedAt,
    },
    overnight: {
      compsIngested,
      popSnapshots,
      catalogCards,
      pokemonSets,
    },
    catalogSync: catalogSyncResults ?? null,
  };
}

export async function persistNightlyPlatformReport(report: NightlyPlatformReport): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("tcg_catalog_sources")
    .select("raw_json")
    .eq("id", CURSOR_SOURCE_ID)
    .maybeSingle();
  const prev = (data?.raw_json as Record<string, unknown>) ?? {};
  await supabase
    .from("tcg_catalog_sources")
    .update({
      raw_json: {
        ...prev,
        lastNightlyReport: report,
        lastNightlyReportAt: report.generatedAt,
      },
    })
    .eq("id", CURSOR_SOURCE_ID);
}
