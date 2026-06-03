import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const since = new Date();
since.setUTCDate(since.getUTCDate() - 45);
const sinceYmd = since.toISOString().slice(0, 10);

const { data } = await s
  .from("pgt_market_comps")
  .select("catalog_id,franchise,kind,price_usd,observed_at")
  .gte("observed_at", sinceYmd)
  .eq("grade_bucket", "raw")
  .limit(5);

const rows = (data ?? []).map((row) => ({
  catalog_id: row.catalog_id,
  franchise: row.franchise ?? "pokemon",
  price_usd: Number(row.price_usd),
  lane: row.kind === "sold" ? "sold_median" : "tcgplayer_market",
  captured_on: String(row.observed_at).slice(0, 10),
}));

const { error } = await s.from("pgt_us_price_ticks").upsert(rows, {
  onConflict: "catalog_id,captured_on,lane",
});
console.log("rows", rows.length, error ? error.message : "ok");
