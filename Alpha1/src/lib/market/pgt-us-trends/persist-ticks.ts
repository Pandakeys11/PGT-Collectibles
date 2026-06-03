import { primaryTcgPlayerFromSnapshot } from "@/lib/market/catalog-raw-fmv";
import type { CatalogPriceSnapshot } from "@/lib/market/pokemon-catalog";
import { isMissingRelationError } from "@/lib/market/supabase-errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

function todayUtcYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Record today's TCGPlayer market anchor for trend history (idempotent per day). */
export async function recordPgtUsPriceTick(
  catalogId: string,
  priceUsd: number,
  lane: "tcgplayer_market" | "sold_median" | "reference" | "blended" = "tcgplayer_market",
): Promise<void> {
  if (!isSupabaseConfigured() || !catalogId.trim() || !Number.isFinite(priceUsd) || priceUsd <= 0) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pgt_us_price_ticks").upsert(
    {
      catalog_id: catalogId.trim(),
      franchise: "pokemon",
      price_usd: Math.round(priceUsd * 100) / 100,
      lane,
      captured_on: todayUtcYmd(),
    },
    { onConflict: "catalog_id,captured_on,lane", ignoreDuplicates: false },
  );

  if (error && !isMissingRelationError(error)) {
    /* non-fatal */
  }
}

export async function recordPgtUsPriceTickFromSnapshot(
  catalogId: string,
  snapshot: CatalogPriceSnapshot,
): Promise<void> {
  const usd = primaryTcgPlayerFromSnapshot(snapshot);
  if (usd == null) return;
  await recordPgtUsPriceTick(catalogId, usd, "tcgplayer_market");
}

export async function loadPgtUsPriceTicks(
  catalogIds: string[],
  lookbackDays = 45,
): Promise<Map<string, Array<{ priceUsd: number; capturedOn: string }>>> {
  const map = new Map<string, Array<{ priceUsd: number; capturedOn: string }>>();
  if (!isSupabaseConfigured() || !catalogIds.length) return map;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDays);
  const sinceYmd = since.toISOString().slice(0, 10);

  const supabase = getSupabaseAdmin();
  const unique = [...new Set(catalogIds.filter(Boolean))];

  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    const { data, error } = await supabase
      .from("pgt_us_price_ticks")
      .select("catalog_id,price_usd,captured_on")
      .in("catalog_id", chunk)
      .gte("captured_on", sinceYmd)
      .order("captured_on", { ascending: false });

    if (error) {
      if (isMissingRelationError(error)) return map;
      continue;
    }

    for (const row of data ?? []) {
      const id = String(row.catalog_id ?? "").trim();
      if (!id || row.price_usd == null) continue;
      const list = map.get(id) ?? [];
      list.push({
        priceUsd: Number(row.price_usd),
        capturedOn: String(row.captured_on).slice(0, 10),
      });
      map.set(id, list);
    }
  }

  return map;
}
