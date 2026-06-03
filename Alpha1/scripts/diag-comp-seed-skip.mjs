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
  .select("catalog_id,kind,price_usd,observed_at,source,grade_bucket")
  .gte("observed_at", sinceYmd)
  .limit(2000);

let noDate = 0;
let noPrice = 0;
let notRaw = 0;
let badKind = 0;
let pass = 0;

for (const row of data ?? []) {
  const b = (row.grade_bucket ?? "").trim().toLowerCase();
  if (b && b !== "raw" && b !== "unknown" && b !== "ungraded") {
    notRaw++;
    continue;
  }
  const kind = String(row.kind ?? "");
  if (kind !== "sold" && kind !== "reference" && kind !== "active") {
    badKind++;
    continue;
  }
  const s = String(row.observed_at ?? "");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) {
    noDate++;
    continue;
  }
  const priceUsd = Number(row.price_usd);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    noPrice++;
    continue;
  }
  pass++;
}

console.log("since", sinceYmd, "rows", data?.length);
console.log({ pass, notRaw, badKind, noDate, noPrice });
if (noDate) {
  console.log("noDate sample", data?.find((r) => !String(r.observed_at ?? "").match(/^(\d{4}-\d{2}-\d{2})/)));
}
