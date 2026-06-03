import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

function isRawGradeBucket(gradeBucket) {
  const b = (gradeBucket ?? "").trim().toLowerCase();
  if (!b || b === "raw" || b === "unknown" || b === "ungraded") return true;
  return false;
}

function isUsCompRow(kind, source) {
  if (kind === "sold" || kind === "active") return true;
  const src = (source ?? "").toLowerCase();
  return (
    src.includes("tcgplayer") ||
    src.includes("ebay") ||
    src.includes("pricecharting") ||
    src.includes("pgt")
  );
}

function ymd(value) {
  if (value == null) return null;
  const m = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

const since = new Date();
since.setUTCDate(since.getUTCDate() - 45);
const sinceYmd = since.toISOString().slice(0, 10);

const { data } = await s
  .from("pgt_market_comps")
  .select("catalog_id,franchise,kind,price_usd,observed_at,source,grade_bucket")
  .gte("observed_at", sinceYmd)
  .order("observed_at", { ascending: true })
  .limit(500);

const tickBatch = [];
for (const row of data ?? []) {
  if (!isRawGradeBucket(row.grade_bucket)) continue;
  const kind = String(row.kind ?? "");
  if (kind !== "sold" && kind !== "reference" && kind !== "active") continue;
  if (!isUsCompRow(kind, row.source)) continue;
  const capturedOn = ymd(row.observed_at);
  const priceUsd = Number(row.price_usd);
  const catalogId = String(row.catalog_id ?? "").trim();
  if (!capturedOn || !catalogId || !Number.isFinite(priceUsd) || priceUsd <= 0) continue;
  tickBatch.push({
    catalog_id: catalogId,
    franchise: String(row.franchise ?? "pokemon").toLowerCase() || "pokemon",
    price_usd: Math.round(priceUsd * 100) / 100,
    lane: kind === "sold" ? "sold_median" : "tcgplayer_market",
    captured_on: capturedOn,
  });
  if (tickBatch.length >= 400) break;
}

console.log("batch size", tickBatch.length);
const { error } = await s.from("pgt_us_price_ticks").upsert(tickBatch, {
  onConflict: "catalog_id,captured_on,lane",
});
console.log(error ? `FAIL: ${error.message} ${error.details}` : "ok");
