/**
 * Daily US TCG anchors for PGT trends (used by catalog price backfill).
 */

export function primaryTcgUsdFromPricesJson(pricesJson) {
  const rows = pricesJson?.tcgPlayerPrices;
  if (!Array.isArray(rows)) return null;
  let best = null;
  for (const row of rows) {
    const usd = row?.market ?? row?.mid ?? row?.low;
    if (usd == null || usd < 0.5) continue;
    if (best == null || usd > best) best = usd;
  }
  return best;
}

export function dedupeTickRows(tickRows) {
  const map = new Map();
  for (const row of tickRows) {
    map.set(`${row.catalog_id}|${row.captured_on}|${row.lane}`, row);
  }
  return [...map.values()];
}

export async function upsertPgtUsPriceTicksBatch(supabase, tickRows) {
  const unique = dedupeTickRows(tickRows);
  if (!unique.length) return 0;
  let written = 0;
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { error } = await supabase.from("pgt_us_price_ticks").upsert(chunk, {
      onConflict: "catalog_id,captured_on,lane",
      ignoreDuplicates: false,
    });
    if (!error) written += chunk.length;
  }
  return written;
}

export function tickRowsFromPricesJson(catalogId, pricesJson, franchise = "pokemon") {
  const usd = primaryTcgUsdFromPricesJson(pricesJson);
  if (usd == null) return [];

  const today = new Date().toISOString().slice(0, 10);
  const rows = [
    {
      catalog_id: catalogId,
      franchise,
      price_usd: Math.round(usd * 100) / 100,
      lane: "tcgplayer_market",
      captured_on: today,
    },
  ];

  const updated = pricesJson?.tcgPlayerUpdatedAt;
  const m = updated ? String(updated).match(/^(\d{4}-\d{2}-\d{2})/) : null;
  const backdate = m?.[1];
  if (backdate && backdate !== today) {
    rows.push({
      catalog_id: catalogId,
      franchise,
      price_usd: Math.round(usd * 100) / 100,
      lane: "tcgplayer_market",
      captured_on: backdate,
    });
  }

  return rows;
}
