import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

/** Vintage + modern chase sets — liquid / high collector interest. */
export const LIQUID_PRIORITY_SET_CODES = new Set([
  "base1",
  "base2",
  "base3",
  "base4",
  "base5",
  "base6",
  "gym1",
  "gym2",
  "neo1",
  "neo2",
  "neo3",
  "neo4",
  "sv1",
  "sv2",
  "sv3",
  "sv3pt5",
  "sv4",
  "sv4pt5",
  "sv5",
  "sv6",
  "sv6pt5",
  "sv7",
  "sv8",
  "sv8pt5",
  "swsh1",
  "swsh9",
  "swsh10",
  "swsh11",
  "swsh12",
  "swsh12pt5",
  "cel25",
  "pgo",
  "sma",
]);

const CHASE_RARITY_RE =
  /secret|ultra|illustration|special illustration|hyper|rainbow|gold|shiny|rare holo vmax|rare holo vstar|ace spec|double rare|classic collection|promo/i;

export type CatalogIngestCandidate = {
  catalogId: string;
  setCode: string | null;
  name: string;
  rarity: string | null;
  score: number;
  reasons: string[];
};

function scoreRow(row: {
  catalog_id: string;
  set_code: string | null;
  name: string;
  rarity: string | null;
  prices_json: Record<string, unknown> | null;
  raw_json: Record<string, unknown> | null;
  synced_at: string | null;
  hasComps: boolean;
  compAgeDays: number | null;
}): CatalogIngestCandidate {
  const reasons: string[] = [];
  let score = 0;
  const setCode = row.set_code?.trim() || null;
  const rarity = row.rarity?.trim() || "";

  if (!row.hasComps) {
    score += 80;
    reasons.push("no_comps");
  } else if (row.compAgeDays != null && row.compAgeDays > 28) {
    score += 45;
    reasons.push("stale_comps");
  }

  if (setCode && LIQUID_PRIORITY_SET_CODES.has(setCode)) {
    score += 35;
    reasons.push("liquid_set");
  }

  if (CHASE_RARITY_RE.test(rarity)) {
    score += 40;
    reasons.push("chase_rarity");
  }

  const prices = row.prices_json ?? {};
  const tcgPrices = prices.tcgPlayerPrices;
  if (Array.isArray(tcgPrices)) {
    for (const v of tcgPrices) {
      const m = typeof v === "object" && v && "market" in v ? (v as { market?: number }).market : null;
      if (typeof m === "number" && m >= 25) {
        score += Math.min(30, Math.floor(m / 10));
        reasons.push("tcg_market_price");
        break;
      }
    }
  }

  if (row.synced_at) {
    const ageMs = Date.now() - Date.parse(row.synced_at);
    if (Number.isFinite(ageMs) && ageMs < 120 * 24 * 60 * 60 * 1000) {
      score += 12;
      reasons.push("recent_set_sync");
    }
  }

  const raw = row.raw_json ?? {};
  if (typeof raw.pokemonId === "string") {
    score += 2;
  }

  return {
    catalogId: row.catalog_id,
    setCode,
    name: row.name,
    rarity: rarity || null,
    score,
    reasons,
  };
}

/**
 * Pick catalog_ids for nightly market ingest: chase + liquid + stale/missing comps first.
 */
export async function selectCatalogIdsForMarketIngest(options?: {
  priorityLimit?: number;
  rotationLimit?: number;
  rotationOffset?: number;
}): Promise<{
  priority: CatalogIngestCandidate[];
  rotation: CatalogIngestCandidate[];
  nextRotationOffset: number;
}> {
  const priorityLimit = Math.min(40, Math.max(1, options?.priorityLimit ?? 15));
  const rotationLimit = Math.min(30, Math.max(0, options?.rotationLimit ?? 10));
  const rotationOffset = Math.max(0, options?.rotationOffset ?? 0);

  if (!isSupabaseConfigured()) {
    return { priority: [], rotation: [], nextRotationOffset: rotationOffset };
  }

  const supabase = getSupabaseAdmin();

  const pageSize = 2000;
  const cards: Array<{
    catalog_id: unknown;
    set_code: unknown;
    name: unknown;
    rarity: unknown;
    prices_json: unknown;
    raw_json: unknown;
    synced_at: unknown;
  }> = [];
  for (let page = 0; page < 50; page += 1) {
    const { data: batch, error: batchError } = await supabase
      .from("tcg_catalog_cards")
      .select("catalog_id,set_code,name,rarity,prices_json,raw_json,synced_at")
      .eq("franchise", "pokemon")
      .order("catalog_id")
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (batchError) {
      return { priority: [], rotation: [], nextRotationOffset: rotationOffset };
    }
    if (!batch?.length) break;
    cards.push(...batch);
    if (batch.length < pageSize) break;
  }

  if (!cards.length) {
    return { priority: [], rotation: [], nextRotationOffset: rotationOffset };
  }

  const compMeta = new Map<string, { count: number; latest: string | null }>();
  let compPage = 0;
  const compPageSize = 1000;
  for (;;) {
    const { data: compRows } = await supabase
      .from("pgt_market_comps")
      .select("catalog_id,ingested_at")
      .eq("franchise", "pokemon")
      .order("ingested_at", { ascending: false })
      .range(compPage * compPageSize, (compPage + 1) * compPageSize - 1);
    if (!compRows?.length) break;
    for (const row of compRows) {
      const id = String(row.catalog_id);
      const hit = compMeta.get(id) ?? { count: 0, latest: null };
      hit.count += 1;
      const at = row.ingested_at ? String(row.ingested_at) : null;
      if (at && (!hit.latest || at > hit.latest)) hit.latest = at;
      compMeta.set(id, hit);
    }
    if (compRows.length < compPageSize) break;
    compPage += 1;
    if (compPage >= 30) break;
  }

  const scored = cards.map((row) => {
    const id = String(row.catalog_id);
    const meta = compMeta.get(id);
    const compAgeDays =
      meta?.latest != null
        ? (Date.now() - Date.parse(meta.latest)) / (24 * 60 * 60 * 1000)
        : null;
    return scoreRow({
      catalog_id: id,
      set_code: row.set_code as string | null,
      name: String(row.name ?? ""),
      rarity: row.rarity as string | null,
      prices_json: (row.prices_json as Record<string, unknown>) ?? null,
      raw_json: (row.raw_json as Record<string, unknown>) ?? null,
      synced_at: row.synced_at as string | null,
      hasComps: (meta?.count ?? 0) > 0,
      compAgeDays,
    });
  });

  scored.sort((a, b) => b.score - a.score || a.catalogId.localeCompare(b.catalogId));

  const priority = scored.slice(0, priorityLimit);
  const priorityIds = new Set(priority.map((p) => p.catalogId));

  const rotationPool = scored.filter((s) => !priorityIds.has(s.catalogId));
  const rotation: CatalogIngestCandidate[] = [];
  for (let i = 0; i < rotationLimit; i += 1) {
    const idx = (rotationOffset + i) % Math.max(1, rotationPool.length);
    rotation.push(rotationPool[idx]!);
  }

  const nextRotationOffset =
    rotationPool.length > 0 ? (rotationOffset + rotationLimit) % rotationPool.length : 0;

  return { priority, rotation, nextRotationOffset };
}

const CURSOR_SOURCE_ID = "pokemontcg.io";
const CURSOR_KEY = "marketIngestRotationOffset";

export async function readMarketIngestRotationOffset(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("tcg_catalog_sources")
    .select("raw_json")
    .eq("id", CURSOR_SOURCE_ID)
    .maybeSingle();
  const raw = (data?.raw_json as Record<string, unknown>) ?? {};
  const n = Number(raw[CURSOR_KEY]);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export async function writeMarketIngestRotationOffset(offset: number): Promise<void> {
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
      raw_json: { ...prev, [CURSOR_KEY]: offset },
    })
    .eq("id", CURSOR_SOURCE_ID);
}
