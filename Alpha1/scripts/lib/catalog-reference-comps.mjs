/**
 * Write TCGPlayer/Cardmarket reference rows to pgt_market_comps (FMV spine).
 */

import {
  priceSnapshotFromPokemonApiCard,
  snapshotHasTcgMarketPrices,
} from "./catalog-price-snapshot.mjs";

function observedYmd(iso) {
  if (!iso?.trim()) return new Date().toISOString().slice(0, 10);
  const m = String(iso).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? new Date().toISOString().slice(0, 10);
}

export function referenceCompsFromPricesJson(catalogId, name, pricesJson, franchise = "pokemon") {
  const snap = priceSnapshotFromPokemonApiCard({
    tcgplayer: {
      url: pricesJson?.tcgPlayerUrl ?? undefined,
      updatedAt: pricesJson?.tcgPlayerUpdatedAt ?? undefined,
      prices: Object.fromEntries(
        (pricesJson?.tcgPlayerPrices ?? []).map((r) => [
          r.variant,
          { market: r.market, mid: r.mid, low: r.low, high: r.high },
        ]),
      ),
    },
    cardmarket: pricesJson?.cardMarket
      ? {
          url: pricesJson.cardMarketUrl ?? undefined,
          updatedAt: pricesJson.cardMarketUpdatedAt ?? undefined,
          prices: pricesJson.cardMarket,
        }
      : undefined,
  });

  if (!snapshotHasTcgMarketPrices(snap) && !snap.cardMarket?.trendPrice) {
    return [];
  }

  const observedAt = observedYmd(snap.tcgPlayerUpdatedAt ?? snap.cardMarketUpdatedAt);
  const out = [];

  for (const row of snap.tcgPlayerPrices) {
    const usd = row.market ?? row.mid ?? row.low;
    if (usd == null || usd < 0.5) continue;
    const url = snap.tcgPlayerUrl?.trim();
    if (!url) continue;
    out.push({
      catalog_id: catalogId,
      franchise,
      grade_bucket: "raw",
      kind: "reference",
      title: `${name} · ${row.variant} · TCGPlayer market`,
      price_usd: Math.round(usd * 100) / 100,
      observed_at: observedAt,
      url,
      source: "TCGPlayer",
      slab: null,
      identity_hash: `backfill|${catalogId}|${row.variant}`,
    });
  }

  const cm = snap.cardMarket;
  if (cm?.trendPrice != null && cm.trendPrice >= 0.5 && snap.cardMarketUrl?.trim()) {
    out.push({
      catalog_id: catalogId,
      franchise,
      grade_bucket: "raw",
      kind: "reference",
      title: `${name} · Cardmarket trend`,
      price_usd: Math.round(cm.trendPrice),
      observed_at: observedYmd(snap.cardMarketUpdatedAt),
      url: snap.cardMarketUrl.trim(),
      source: "Cardmarket",
      slab: null,
      identity_hash: `backfill|${catalogId}|cm-trend`,
    });
  }

  return out.slice(0, 12);
}

export async function persistReferenceCompsBatch(supabase, compRows) {
  if (!compRows.length) return 0;
  const chunkSize = 100;
  let written = 0;
  for (let i = 0; i < compRows.length; i += chunkSize) {
    const chunk = compRows.slice(i, i + chunkSize);
    const { error } = await supabase.from("pgt_market_comps").upsert(chunk, {
      onConflict:
        "catalog_id,grade_bucket,kind,url,price_usd,observed_at,source,identity_hash",
      ignoreDuplicates: false,
    });
    if (error) {
      console.warn(`  comps upsert warning: ${error.message}`);
    } else {
      written += chunk.length;
    }
  }
  return written;
}
