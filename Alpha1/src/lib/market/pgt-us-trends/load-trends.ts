import type { PgtUsPricePoint } from "@/lib/market/pgt-us-trends/compute";
import { resolvePgtUsTrend } from "@/lib/market/pgt-us-trends/compute";
import { loadPgtUsPriceTicks } from "@/lib/market/pgt-us-trends/persist-ticks";
import type { PgtUsTrendResult } from "@/lib/market/pgt-us-trends/types";
import { isMissingRelationError } from "@/lib/market/supabase-errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

function compRowToPoint(row: {
  kind: string;
  price_usd: number | null;
  observed_at: string | null;
  source: string | null;
  grade_bucket: string | null;
}): PgtUsPricePoint | null {
  if (row.price_usd == null || !Number.isFinite(Number(row.price_usd))) return null;
  const bucket = row.grade_bucket ?? "raw";
  if (bucket !== "raw" && bucket !== "unknown") return null;
  const kind =
    row.kind === "sold" || row.kind === "active" || row.kind === "reference"
      ? row.kind
      : null;
  if (!kind) return null;
  return {
    priceUsd: Number(row.price_usd),
    observedAt: row.observed_at ? String(row.observed_at).slice(0, 10) : null,
    kind,
    source: row.source,
  };
}

async function loadCompsForCatalogIds(
  catalogIds: string[],
): Promise<Map<string, PgtUsPricePoint[]>> {
  const map = new Map<string, PgtUsPricePoint[]>();
  if (!isSupabaseConfigured() || !catalogIds.length) return map;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 45);
  const sinceYmd = since.toISOString().slice(0, 10);

  const supabase = getSupabaseAdmin();
  const unique = [...new Set(catalogIds.filter(Boolean))];

  for (let i = 0; i < unique.length; i += 60) {
    const chunk = unique.slice(i, i + 60);
    const { data, error } = await supabase
      .from("pgt_market_comps")
      .select("catalog_id,kind,price_usd,observed_at,source,grade_bucket")
      .in("catalog_id", chunk)
      .gte("observed_at", sinceYmd)
      .order("observed_at", { ascending: false })
      .limit(chunk.length * 40);

    if (error) {
      if (isMissingRelationError(error)) return map;
      continue;
    }

    for (const row of data ?? []) {
      const id = String(row.catalog_id ?? "").trim();
      if (!id) continue;
      const pt = compRowToPoint(row as Parameters<typeof compRowToPoint>[0]);
      if (!pt) continue;
      const list = map.get(id) ?? [];
      if (list.length >= 36) continue;
      list.push(pt);
      map.set(id, list);
    }
  }

  return map;
}

/** Batch-resolve PGT US 7d/30d trends for catalog cards. */
export async function loadPgtUsTrendsForCatalogIds(
  catalogIds: string[],
): Promise<Map<string, PgtUsTrendResult>> {
  const out = new Map<string, PgtUsTrendResult>();
  if (!catalogIds.length) return out;

  const [compsById, ticksById] = await Promise.all([
    loadCompsForCatalogIds(catalogIds),
    loadPgtUsPriceTicks(catalogIds),
  ]);

  for (const id of catalogIds) {
    const trend = resolvePgtUsTrend({
      comps: compsById.get(id),
      ticks: ticksById.get(id),
    });
    if (trend) out.set(id, trend);
  }

  return out;
}
