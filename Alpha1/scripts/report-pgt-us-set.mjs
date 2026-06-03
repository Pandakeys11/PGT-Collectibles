/**
 * Lightweight PGT US trend readiness for one set (no full insight build).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const setCode = process.argv.find((a) => a.startsWith("--set="))?.split("=")[1]?.trim() ?? "me2";

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const since = new Date();
since.setUTCDate(since.getUTCDate() - 45);
const sinceYmd = since.toISOString().slice(0, 10);
const start7 = new Date();
start7.setUTCDate(start7.getUTCDate() - 7);
const start7Ymd = start7.toISOString().slice(0, 10);

const { data: cards } = await s
  .from("tcg_catalog_cards")
  .select("catalog_id,prices_json")
  .eq("franchise", "pokemon")
  .eq("set_code", setCode);

const ids = (cards ?? []).map((c) => c.catalog_id).filter(Boolean);
let priced = 0;
for (const c of cards ?? []) {
  const pj = c.prices_json;
  const rows = pj?.tcgPlayerPrices;
  if (Array.isArray(rows) && rows.some((r) => r?.market != null || r?.mid != null)) priced++;
}

let ticks7 = 0;
let ticks30 = 0;
let comps7 = 0;

for (let i = 0; i < ids.length; i += 80) {
  const chunk = ids.slice(i, i + 80);
  const { data: ticks } = await s
    .from("pgt_us_price_ticks")
    .select("catalog_id,captured_on")
    .in("catalog_id", chunk)
    .gte("captured_on", sinceYmd);
  const byId7 = new Set();
  const byId30 = new Set();
  for (const t of ticks ?? []) {
    if (t.captured_on >= start7Ymd) byId7.add(t.catalog_id);
    byId30.add(t.catalog_id);
  }
  ticks7 += byId7.size;
  ticks30 += byId30.size;

  const { data: comps } = await s
    .from("pgt_market_comps")
    .select("catalog_id,observed_at,grade_bucket,kind")
    .in("catalog_id", chunk)
    .gte("observed_at", sinceYmd)
    .eq("grade_bucket", "raw");
  const compsBy7 = new Set();
  for (const c of comps ?? []) {
    const d = String(c.observed_at ?? "").slice(0, 10);
    if (d >= start7Ymd && (c.kind === "sold" || c.kind === "active")) compsBy7.add(c.catalog_id);
  }
  comps7 += compsBy7.size;
}

const { count: totalTicks } = await s
  .from("pgt_us_price_ticks")
  .select("*", { count: "exact", head: true });

console.log(
  JSON.stringify(
    {
      setCode,
      cards: ids.length,
      priced,
      pricedPct: ids.length ? Math.round((100 * priced) / ids.length) : 0,
      cardsWithTicksIn30d: ticks30,
      cardsWithTicksIn7d: ticks7,
      cardsWithSoldActiveCompsIn7d: comps7,
      tickCoverage30dPct: ids.length ? Math.round((100 * ticks30) / ids.length) : 0,
      pgt_us_price_ticks_total: totalTicks,
    },
    null,
    2,
  ),
);
