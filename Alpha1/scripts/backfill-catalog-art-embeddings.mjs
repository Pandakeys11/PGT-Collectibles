/**
 * Backfill Gemini art embeddings for master catalog rows.
 *
 * Usage:
 *   node scripts/backfill-catalog-art-embeddings.mjs --franchise=pokemon --limit=500
 *   node scripts/backfill-catalog-art-embeddings.mjs --franchise=pokemon --limit=2000 --offset=500
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
const franchise =
  process.argv.find((a) => a.startsWith("--franchise="))?.split("=")[1] ?? "pokemon";
const limit = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "500",
);
const offset = Number(
  process.argv.find((a) => a.startsWith("--offset="))?.split("=")[1] ?? "0",
);
const model = process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";
const dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS?.trim() || "768");

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
  const res = await fetch(target.toString(), { headers: { Accept: "image/*" } });
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > 6 * 1024 * 1024) return null;
  return { base64: buf.toString("base64"), mimeType };
}

async function embedImage(base64, mimeType) {
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
        content: {
          parts: [{ inline_data: { mime_type: mimeType, data: base64 } }],
        },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: dimensions,
      }),
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

async function main() {
  const { data: rows, error } = await supabase
    .from("tcg_catalog_cards")
    .select("catalog_id,image_large_url,image_small_url")
    .eq("franchise", franchise)
    .not("image_large_url", "is", null)
    .order("catalog_id")
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Catalog query failed:", error.message);
    process.exit(1);
  }

  console.log(`Embedding ${rows?.length ?? 0} ${franchise} cards (offset ${offset})…`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const imageUrl = row.image_large_url ?? row.image_small_url;
    if (!imageUrl) {
      skipped += 1;
      continue;
    }

    const { data: existing } = await supabase
      .from("tcg_catalog_art_embeddings")
      .select("catalog_id")
      .eq("franchise", franchise)
      .eq("catalog_id", row.catalog_id)
      .eq("model", model)
      .maybeSingle();

    if (existing?.catalog_id) {
      skipped += 1;
      continue;
    }

    try {
      const image = await fetchImageBase64(imageUrl);
      if (!image) {
        skipped += 1;
        continue;
      }
      const embedding = await embedImage(image.base64, image.mimeType);
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
      if (ok % 25 === 0) console.log(`  embedded ${ok}…`);
      await sleep(120);
    } catch (err) {
      failed += 1;
      console.warn(`  ${row.catalog_id}: ${err instanceof Error ? err.message : err}`);
      await sleep(400);
    }
  }

  console.log(`Done. embedded=${ok} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
