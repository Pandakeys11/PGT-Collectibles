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

const stats = { scanned: 0, pass: 0, notRaw: 0, badKind: 0, notUs: 0, noDate: 0, noPrice: 0 };

for (let page = 0; page < 50; page++) {
  const { data } = await s
    .from("pgt_market_comps")
    .select("catalog_id,kind,price_usd,observed_at,source,grade_bucket")
    .gte("observed_at", sinceYmd)
    .range(page * 500, (page + 1) * 500 - 1);
  if (!data?.length) break;

  for (const row of data) {
    stats.scanned++;
    if (!isRawGradeBucket(row.grade_bucket)) {
      stats.notRaw++;
      continue;
    }
    const kind = String(row.kind ?? "");
    if (kind !== "sold" && kind !== "reference" && kind !== "active") {
      stats.badKind++;
      continue;
    }
    if (!isUsCompRow(kind, row.source)) {
      stats.notUs++;
      continue;
    }
    const capturedOn = ymd(row.observed_at);
    const priceUsd = Number(row.price_usd);
    const catalogId = String(row.catalog_id ?? "").trim();
    if (!capturedOn || !catalogId || !Number.isFinite(priceUsd) || priceUsd <= 0) {
      if (!capturedOn) stats.noDate++;
      else stats.noPrice++;
      continue;
    }
    stats.pass++;
  }
  if (data.length < 500) break;
}

console.log(stats);
