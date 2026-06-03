import { isMissingRelationError } from "@/lib/market/supabase-errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type SeedPgtUsTicksFromCompsResult = {
  scanned: number;
  written: number;
  skipped: number;
};

function ymd(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function isUsCompRow(row: {
  kind: string;
  source: string | null;
}): boolean {
  // Sold/active rows come from PGT US market ingest (eBay, TCGPlayer, PriceCharting).
  if (row.kind === "sold" || row.kind === "active") return true;
  const src = (row.source ?? "").toLowerCase();
  return (
    src.includes("tcgplayer") ||
    src.includes("ebay") ||
    src.includes("pricecharting") ||
    src.includes("pgt")
  );
}

function laneForKind(kind: string): "tcgplayer_market" | "sold_median" | "reference" {
  if (kind === "sold") return "sold_median";
  return "tcgplayer_market";
}

/** Raw / ungraded comps only — tolerate null and legacy empty bucket values. */
function isRawGradeBucket(gradeBucket: string | null | undefined): boolean {
  const b = (gradeBucket ?? "").trim().toLowerCase();
  if (!b || b === "raw" || b === "unknown" || b === "ungraded") return true;
  return false;
}

/**
 * Mirror historical `pgt_market_comps` into `pgt_us_price_ticks` (fast spine bootstrap).
 */
export async function seedPgtUsTicksFromMarketComps(options?: {
  setCode?: string | null;
  lookbackDays?: number;
  pageSize?: number;
  dryRun?: boolean;
}): Promise<SeedPgtUsTicksFromCompsResult> {
  const result: SeedPgtUsTicksFromCompsResult = { scanned: 0, written: 0, skipped: 0 };
  if (!isSupabaseConfigured()) return result;

  const lookbackDays = Math.min(365, Math.max(7, options?.lookbackDays ?? 45));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDays);
  const sinceYmd = since.toISOString().slice(0, 10);
  const pageSize = Math.min(500, Math.max(50, options?.pageSize ?? 200));

  const supabase = getSupabaseAdmin();
  let catalogFilter: string[] | null = null;

  if (options?.setCode?.trim()) {
    const setCode = options.setCode.trim();
    const ids: string[] = [];
    for (let page = 0; page < 200; page++) {
      const { data, error } = await supabase
        .from("tcg_catalog_cards")
        .select("catalog_id")
        .eq("franchise", "pokemon")
        .eq("set_code", setCode)
        .range(page * 500, (page + 1) * 500 - 1);
      if (error) break;
      if (!data?.length) break;
      for (const row of data) {
        const id = String(row.catalog_id ?? "").trim();
        if (id) ids.push(id);
      }
      if (data.length < 500) break;
    }
    if (!ids.length) return result;
    catalogFilter = ids;
  }

  type TickRow = {
    catalog_id: string;
    franchise: string;
    price_usd: number;
    lane: "tcgplayer_market" | "sold_median" | "reference";
    captured_on: string;
  };

  const tickBatch = new Map<string, TickRow>();
  const tickKey = (r: TickRow) => `${r.catalog_id}|${r.captured_on}|${r.lane}`;

  const flush = async () => {
    if (!tickBatch.size || options?.dryRun) {
      tickBatch.clear();
      return;
    }
    const chunk = [...tickBatch.values()];
    tickBatch.clear();
    const { error } = await supabase.from("pgt_us_price_ticks").upsert(chunk, {
      onConflict: "catalog_id,captured_on,lane",
      ignoreDuplicates: false,
    });
    if (error && !isMissingRelationError(error)) {
      if (result.skipped === 0) {
        console.warn("[pgt-us-trends] tick upsert error:", error.message);
      }
      result.skipped += chunk.length;
    } else {
      result.written += chunk.length;
    }
  };

  const scanCompPage = async (catalogIds: string[] | null, offset: number) => {
    let q = supabase
      .from("pgt_market_comps")
      .select("catalog_id,franchise,kind,price_usd,observed_at,source,grade_bucket")
      .gte("observed_at", sinceYmd)
      .not("price_usd", "is", null)
      .order("observed_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (catalogIds?.length) {
      q = q.in("catalog_id", catalogIds);
    }

    return q;
  };

  type CompRow = {
    catalog_id: string;
    franchise: string | null;
    kind: string;
    price_usd: number;
    observed_at: string | null;
    source: string | null;
    grade_bucket: string | null;
  };

  const processRows = async (data: CompRow[]) => {
    for (const row of data) {
      result.scanned += 1;
      if (!isRawGradeBucket(row.grade_bucket)) {
        result.skipped += 1;
        continue;
      }
      const kind = String(row.kind ?? "");
      if (kind !== "sold" && kind !== "reference" && kind !== "active") {
        result.skipped += 1;
        continue;
      }
      if (!isUsCompRow({ kind, source: row.source })) {
        result.skipped += 1;
        continue;
      }
      const capturedOn = ymd(row.observed_at);
      const priceUsd = Number(row.price_usd);
      const catalogId = String(row.catalog_id ?? "").trim();
      if (!capturedOn || !catalogId || !Number.isFinite(priceUsd) || priceUsd <= 0) {
        result.skipped += 1;
        continue;
      }

      const tick: TickRow = {
        catalog_id: catalogId,
        franchise: String(row.franchise ?? "pokemon").toLowerCase() || "pokemon",
        price_usd: Math.round(priceUsd * 100) / 100,
        lane: laneForKind(kind),
        captured_on: capturedOn,
      };
      tickBatch.set(tickKey(tick), tick);

      if (tickBatch.size >= 400) await flush();
    }
  };

  const idChunks = catalogFilter
    ? (() => {
        const chunks: string[][] = [];
        for (let i = 0; i < catalogFilter.length; i += 80) {
          chunks.push(catalogFilter.slice(i, i + 80));
        }
        return chunks;
      })()
    : [null];

  for (const ids of idChunks) {
    let offset = 0;
    for (;;) {
      const { data, error } = await scanCompPage(ids, offset);
      if (error) {
        if (isMissingRelationError(error)) return result;
        break;
      }
      if (!data?.length) break;
      await processRows(data);
      offset += data.length;
      if (data.length < pageSize) break;
    }
  }

  await flush();
  return result;
}
