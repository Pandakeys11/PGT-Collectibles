/**
 * Backfill Gemini art embeddings for master catalog rows.
 *
 * Usage:
 *   node scripts/backfill-catalog-art-embeddings.mjs --franchise=pokemon --limit=500
 *   node scripts/backfill-catalog-art-embeddings.mjs --franchise=pokemon --all
 *   node scripts/backfill-catalog-art-embeddings.mjs --franchise=all --all
 *
 * Requires GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY), Supabase service role.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const geminiKey =
  process.env.GEMINI_API_KEY?.trim() ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
const franchiseArg =
  process.argv.find((a) => a.startsWith("--franchise="))?.split("=")[1] ?? "pokemon";
const runAll = process.argv.includes("--all");
const limit = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "250",
);
const offsetArg = process.argv.find((a) => a.startsWith("--offset="));
const startOffset = offsetArg ? Number(offsetArg.split("=")[1]) : 0;
const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-2";
const dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS?.trim() || "768");
const delayMs = Number(process.env.ART_EMBED_DELAY_MS?.trim() || "80");

const FRANCHISES = ["pokemon", "magic", "yugioh", "lorcana", "onepiece", "dragonball"];

if (!url || !key) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}
if (!geminiKey) {
  console.error("Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const ALLOWED_HOSTS = new Set([
  "images.pokemontcg.io",
  "images.scrydex.com",
  "images.pokemoncard.io",
  "product-images.tcgplayer.com",
  "tcgplayer-cdn.tcgplayer.com",
  "assets.tcgdex.net",
  "assets.pokemon.com",
  "cards.scryfall.io",
  "images.ygoprodeck.com",
]);

function hostAllowed(hostname) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".supabase.co")) return true;
  if (hostname.endsWith(".supabase.in")) return true;
  return false;
}

async function fetchImageBase64(imageUrl) {
  const target = new URL(imageUrl);
  if (target.protocol !== "https:" || !hostAllowed(target.hostname)) return null;
  const res = await fetch(target.toString(), {
    headers: { Accept: "image/*" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > 6 * 1024 * 1024) return null;
  return { base64: buf.toString("base64"), mimeType };
}

function catalogTextLabel(row) {
  return [row.name, row.set_name, row.card_number].filter(Boolean).join(" · ");
}

async function embedImage(base64, mimeType, textLabel) {
  const parts = [];
  if (textLabel?.trim()) parts.push({ text: textLabel.trim() });
  parts.push({ inline_data: { mime_type: mimeType, data: base64 } });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: dimensions,
      }),
      signal: AbortSignal.timeout(25_000),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini embed ${res.status}`);
  }
  const values = data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) return null;
  return values;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countFranchiseCards(franchise) {
  const { count, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id", { count: "exact", head: true })
    .eq("franchise", franchise)
    .not("image_large_url", "is", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countExistingEmbeddings(franchise) {
  const { count, error } = await supabase
    .from("tcg_catalog_art_embeddings")
    .select("catalog_id", { count: "exact", head: true })
    .eq("franchise", franchise)
    .eq("model", model);
  if (error) {
    if (error.message.includes("does not exist")) return 0;
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function backfillFranchise(franchise) {
  const total = await countFranchiseCards(franchise);
  const existing = await countExistingEmbeddings(franchise);
  console.log(`\n=== ${franchise} === cards w/ art: ${total}, embeddings cached: ${existing}`);

  if (total === 0) {
    console.log("  skip (no catalog rows with art)");
    return { ok: 0, skipped: 0, failed: 0 };
  }

  let offset = startOffset;
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  const batchSize = runAll ? Math.max(limit, 250) : limit;

  while (true) {
    const { data: rows, error } = await supabase
      .from("tcg_catalog_cards")
      .select("catalog_id,name,set_name,card_number,image_large_url,image_small_url")
      .eq("franchise", franchise)
      .or("image_large_url.not.is.null,image_small_url.not.is.null")
      .order("catalog_id")
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error("Catalog query failed:", error.message);
      break;
    }
    if (!rows?.length) break;

    for (const row of rows) {
      const imageUrl = row.image_small_url ?? row.image_large_url;
      if (!imageUrl) {
        skipped += 1;
        continue;
      }
      const textLabel = catalogTextLabel(row);

      const { data: existingRow } = await supabase
        .from("tcg_catalog_art_embeddings")
        .select("catalog_id")
        .eq("franchise", franchise)
        .eq("catalog_id", row.catalog_id)
        .eq("model", model)
        .maybeSingle();

      if (existingRow?.catalog_id) {
        skipped += 1;
        continue;
      }

      try {
        const image = await fetchImageBase64(imageUrl);
        if (!image) {
          skipped += 1;
          continue;
        }
        const embedding = await embedImage(image.base64, image.mimeType, textLabel);
        if (!embedding) {
          failed += 1;
          continue;
        }
        const { error: upsertError } = await supabase.from("tcg_catalog_art_embeddings").upsert(
          {
            franchise,
            catalog_id: row.catalog_id,
            model,
            dimensions,
            embedding,
            image_url: imageUrl,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "franchise,catalog_id,model" },
        );
        if (upsertError) throw upsertError;
        ok += 1;
        if (ok % 50 === 0) {
          console.log(`  [${franchise}] embedded ${ok} (offset ~${offset}, skip ${skipped}, fail ${failed})`);
        }
        await sleep(delayMs);
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        if (failed <= 5 || failed % 20 === 0) {
          console.warn(`  [${franchise}] ${row.catalog_id}: ${msg}`);
        }
        if (/429|quota|rate/i.test(msg)) await sleep(3000);
        else await sleep(400);
      }
    }

    offset += rows.length;
    if (!runAll) break;
    if (rows.length < batchSize) break;
  }

  const finalCount = await countExistingEmbeddings(franchise);
  console.log(
    `  done ${franchise}: +${ok} new, skipped=${skipped}, failed=${failed}, total embeddings=${finalCount}/${total}`,
  );
  return { ok, skipped, failed };
}

async function main() {
  const franchises =
    franchiseArg === "all"
      ? FRANCHISES
      : franchiseArg.split(",").map((s) => s.trim()).filter(Boolean);

  console.log(
    `Art embedding backfill — model=${model}, dim=${dimensions}, franchises=${franchises.join(",")}, all=${runAll}`,
  );

  let totalOk = 0;
  let totalFailed = 0;
  for (const franchise of franchises) {
    const result = await backfillFranchise(franchise);
    totalOk += result.ok;
    totalFailed += result.failed;
  }

  console.log(`\nAll franchises complete. new=${totalOk} failed=${totalFailed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
