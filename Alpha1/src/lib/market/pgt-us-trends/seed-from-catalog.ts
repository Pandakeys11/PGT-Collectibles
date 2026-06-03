import { parseCatalogPriceSnapshot } from "@/lib/market/catalog-reference-evidence";
import { primaryTcgPlayerFromSnapshot } from "@/lib/market/catalog-raw-fmv";
import { isMissingRelationError } from "@/lib/market/supabase-errors";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export type SeedPgtUsTicksFromCatalogResult = {
  scanned: number;
  written: number;
  skipped: number;
};

function observedYmd(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const m = iso.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

type TickRow = {
  catalog_id: string;
  franchise: string;
  price_usd: number;
  lane: "tcgplayer_market";
  captured_on: string;
};

/**
 * Batch-write today's TCGPlayer anchor + optional backdated tick from `tcgPlayerUpdatedAt`.
 */
export async function seedPgtUsTicksFromCatalog(options?: {
  setCode?: string | null;
  pageSize?: number;
  dryRun?: boolean;
}): Promise<SeedPgtUsTicksFromCatalogResult> {
  const result: SeedPgtUsTicksFromCatalogResult = { scanned: 0, written: 0, skipped: 0 };
  if (!isSupabaseConfigured()) return result;

  const pageSize = Math.min(500, Math.max(50, options?.pageSize ?? 250));
  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
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
        console.warn("[pgt-us-trends] catalog tick upsert error:", error.message);
      }
      result.skipped += chunk.length;
    } else {
      result.written += chunk.length;
    }
  };

  for (let page = 0; page < 5000; page++) {
    let q = supabase
      .from("tcg_catalog_cards")
      .select("catalog_id,prices_json")
      .eq("franchise", "pokemon")
      .not("prices_json", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (options?.setCode?.trim()) {
      q = q.eq("set_code", options.setCode.trim());
    }

    const { data, error } = await q;
    if (error || !data?.length) break;

    for (const row of data) {
      result.scanned += 1;
      const catalogId = String(row.catalog_id ?? "").trim();
      if (!catalogId) {
        result.skipped += 1;
        continue;
      }

      const snap = parseCatalogPriceSnapshot(
        (row.prices_json as Record<string, unknown> | null) ?? null,
      );
      const usd = primaryTcgPlayerFromSnapshot(snap);
      if (usd == null || usd <= 0) {
        result.skipped += 1;
        continue;
      }

      const priceUsd = Math.round(usd * 100) / 100;
      const todayTick: TickRow = {
        catalog_id: catalogId,
        franchise: "pokemon",
        price_usd: priceUsd,
        lane: "tcgplayer_market",
        captured_on: today,
      };
      tickBatch.set(tickKey(todayTick), todayTick);

      const backdate = observedYmd(snap.tcgPlayerUpdatedAt);
      if (backdate && backdate !== today) {
        const back: TickRow = {
          catalog_id: catalogId,
          franchise: "pokemon",
          price_usd: priceUsd,
          lane: "tcgplayer_market",
          captured_on: backdate,
        };
        tickBatch.set(tickKey(back), back);
      }

      if (options?.dryRun) {
        result.written += tickBatch.size;
        tickBatch.clear();
        continue;
      }

      if (tickBatch.size >= 400) await flush();
    }

    await flush();
    if (data.length < pageSize) break;
  }

  return result;
}
