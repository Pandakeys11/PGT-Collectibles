import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: comp } = await s
  .from("pgt_market_comps")
  .select("catalog_id,franchise,kind,price_usd,observed_at")
  .eq("grade_bucket", "raw")
  .eq("kind", "sold")
  .limit(1)
  .maybeSingle();

if (!comp) {
  console.log("no comp row");
  process.exit(0);
}

const captured = String(comp.observed_at).slice(0, 10);
const row = {
  catalog_id: comp.catalog_id,
  franchise: comp.franchise ?? "pokemon",
  price_usd: Number(comp.price_usd),
  lane: "sold_median",
  captured_on: captured,
};

const { error } = await s.from("pgt_us_price_ticks").upsert([row], {
  onConflict: "catalog_id,captured_on,lane",
});
console.log(error ? `FAIL: ${error.message}` : `OK ${row.catalog_id} ${captured}`);
