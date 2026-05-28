import type { MarketEvidence } from "@/lib/scan/schemas";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { isMissingRelationError } from "@/lib/market/supabase-errors";

function rowToEvidence(row: {
  kind: string;
  title: string;
  price_usd: number | null;
  observed_at: string | null;
  url: string | null;
  source: string | null;
  slab: string | null;
  grade_bucket: string | null;
}): MarketEvidence | null {
  const title = row.title?.trim();
  if (!title) return null;
  const kind =
    row.kind === "sold" || row.kind === "active" || row.kind === "reference"
      ? row.kind
      : "reference";
  const gradeBucket =
    row.grade_bucket === "raw" ||
    row.grade_bucket === "psa9" ||
    row.grade_bucket === "psa10" ||
    row.grade_bucket === "bgs10" ||
    row.grade_bucket === "bgsBlackLabel" ||
    row.grade_bucket === "cgc10" ||
    row.grade_bucket === "cgcPristine10" ||
    row.grade_bucket === "tag10" ||
    row.grade_bucket === "gradedOther" ||
    row.grade_bucket === "unknown"
      ? row.grade_bucket
      : "raw";

  let url: string | null = row.url?.trim() ?? null;
  if (url && !/^https?:\/\//i.test(url)) {
    url = null;
  }

  if (!url && row.price_usd == null) return null;

  return {
    kind,
    title,
    priceUsd:
      typeof row.price_usd === "number" && Number.isFinite(row.price_usd)
        ? row.price_usd
        : null,
    observedAt: row.observed_at ? String(row.observed_at).slice(0, 10) : null,
    url,
    source: row.source ?? null,
    slab: row.slab ?? null,
    gradeBucket,
  };
}

/** Batch-load persisted comps for set insight FMV (sold / active / reference). */
export async function loadSetMarketEvidenceMap(
  catalogIds: string[],
): Promise<Map<string, MarketEvidence[]>> {
  const map = new Map<string, MarketEvidence[]>();
  if (!isSupabaseConfigured() || catalogIds.length === 0) return map;

  const supabase = getSupabaseAdmin();
  const unique = [...new Set(catalogIds.filter(Boolean))];
  const chunkSize = 80;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("pgt_market_comps")
      .select("catalog_id,kind,title,price_usd,observed_at,url,source,slab,grade_bucket")
      .in("catalog_id", chunk)
      .order("observed_at", { ascending: false, nullsFirst: false })
      .limit(chunk.length * 24);

    if (error) {
      if (isMissingRelationError(error)) return map;
      continue;
    }

    for (const row of data ?? []) {
      const id = String(row.catalog_id ?? "").trim();
      if (!id) continue;
      const ev = rowToEvidence(row as Parameters<typeof rowToEvidence>[0]);
      if (!ev) continue;
      const list = map.get(id) ?? [];
      if (list.length >= 20) continue;
      const key = `${ev.kind}|${ev.url ?? ""}|${ev.title}|${ev.priceUsd ?? ""}`;
      if (list.some((e) => `${e.kind}|${e.url ?? ""}|${e.title}|${e.priceUsd ?? ""}` === key)) {
        continue;
      }
      list.push(ev);
      map.set(id, list);
    }
  }

  return map;
}
