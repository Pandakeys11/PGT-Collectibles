import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await s.from("pgt_market_comps").select("grade_bucket,kind,source").limit(500);
if (error) {
  console.error(error.message);
  process.exit(1);
}
const buckets = {};
const kinds = {};
for (const r of data ?? []) {
  const b = r.grade_bucket ?? "(null)";
  buckets[b] = (buckets[b] ?? 0) + 1;
  kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
}
console.log("buckets (sample 500):", buckets);
console.log("kinds:", kinds);
const { count } = await s.from("pgt_us_price_ticks").select("*", { count: "exact", head: true });
console.log("pgt_us_price_ticks count:", count);
