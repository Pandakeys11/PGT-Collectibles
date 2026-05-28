/**
 * Sync validated Japanese Pokemon artwork overlay rows.
 *
 * This intentionally writes to tcg_catalog_localized_artwork, never tcg_catalog_cards.
 *
 * Usage:
 *   npm run catalog:sync:pokemon-japanese-artwork
 *   npm run catalog:sync:pokemon-japanese-artwork -- --manifest src/data/pokedex/japanese-artwork-overlays.json --apply
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const manifestArg = args.includes("--manifest")
  ? args[args.indexOf("--manifest") + 1]
  : process.env.JAPANESE_ARTWORK_MANIFEST;
const manifestPath = manifestArg
  ? path.resolve(process.cwd(), manifestArg)
  : path.join(process.cwd(), "src", "data", "pokedex", "japanese-artwork-overlays.json");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function normalizeImageUrls(imageBase) {
  const base = String(imageBase ?? "").trim().replace(/\/$/, "");
  if (!base) return { small: null, large: null };
  if (base.includes("assets.tcgdex.net") && !/\.(png|webp|jpe?g)$/i.test(base)) {
    return { small: `${base}/low.webp`, large: `${base}/high.webp` };
  }
  return { small: base, large: base };
}

async function fetchTcgdexImage(localizedCatalogId) {
  if (!localizedCatalogId) return null;
  const res = await fetch(
    `https://api.tcgdex.net/v2/ja/cards/${encodeURIComponent(localizedCatalogId)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  const row = await res.json().catch(() => null);
  if (!row?.image) return null;
  return {
    image: row.image,
    name: row.name ?? null,
    setName: row.set?.name ?? null,
    localId: row.localId ?? null,
  };
}

function cleanRow(row, tcgdex) {
  const imageFromBase = normalizeImageUrls(row.imageBaseUrl);
  const imageFromTcgdex = normalizeImageUrls(tcgdex?.image);
  const imageSmallUrl =
    row.imageSmallUrl ?? imageFromBase.small ?? imageFromTcgdex.small ?? null;
  const imageLargeUrl =
    row.imageLargeUrl ?? imageFromBase.large ?? imageFromTcgdex.large ?? imageSmallUrl;
  const source = row.source ?? (row.localizedCatalogId ? "tcgdex" : "manual");
  const confidence = Number(row.matchConfidence ?? 0);

  if (!row.baseCatalogId || !row.language) {
    throw new Error(`Invalid row missing baseCatalogId/language: ${JSON.stringify(row)}`);
  }

  return {
    franchise: "pokemon",
    base_catalog_id: row.baseCatalogId,
    language: row.language,
    localized_catalog_id: row.localizedCatalogId ?? "",
    localized_set_code: row.localizedSetCode ?? null,
    localized_set_name: row.localizedSetName ?? tcgdex?.setName ?? null,
    localized_name: row.localizedName ?? tcgdex?.name ?? null,
    printed_number: row.printedNumber ?? tcgdex?.localId ?? "",
    counterpart_number: row.counterpartNumber ?? null,
    image_small_url: imageSmallUrl,
    image_large_url: imageLargeUrl,
    artwork_match_status: row.artworkMatchStatus ?? (imageSmallUrl ? "exact_japanese_print" : "needs_image_review"),
    match_method: row.matchMethod ?? (row.localizedCatalogId ? "exact_localized_id" : "manual_review"),
    match_confidence: Number.isFinite(confidence) ? confidence : 0,
    source,
    source_payload: {
      ...(row.sourcePayload ?? {}),
      tcgdex: tcgdex ?? undefined,
    },
    updated_at: new Date().toISOString(),
  };
}

function validateManifestRow(row, index) {
  const issues = [];
  if (!row.baseCatalogId?.trim()) issues.push("baseCatalogId");
  if (!row.language?.trim()) issues.push("language");
  if (issues.length) {
    throw new Error(`Manifest row ${index} missing ${issues.join(", ")}`);
  }
}

async function main() {
  if (!existsSync(manifestPath)) {
    console.log(`No Japanese artwork manifest found at ${manifestPath}`);
    console.log("Run: npm run catalog:build:pokemon-japanese-artwork");
    return;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const inputRows = Array.isArray(manifest.rows) ? manifest.rows : [];
  if (inputRows.length === 0) {
    console.log("Manifest has zero rows. Run: npm run catalog:build:pokemon-japanese-artwork");
    return;
  }

  const rows = [];
  let idx = 0;
  for (const row of inputRows) {
    validateManifestRow(row, idx++);
    const tcgdex =
      row.source === "tcgdex" || row.localizedCatalogId
        ? await fetchTcgdexImage(row.localizedCatalogId)
        : null;
    rows.push(cleanRow(row, tcgdex));
  }

  const validated = rows.filter(
    (r) =>
      r.artwork_match_status === "exact_japanese_print" ||
      r.artwork_match_status === "same_art_confirmed",
  );
  const withImage = validated.filter((r) => r.image_small_url || r.image_large_url);

  console.log(`Prepared ${rows.length} Japanese artwork overlay row(s).`);
  console.log(`  Validated status: ${validated.length}`);
  console.log(`  With image URL:   ${withImage.length}`);
  for (const row of rows.slice(0, 10)) {
    console.log(
      `  ${row.base_catalog_id} <- ${row.localized_catalog_id || "manual"} / ${row.artwork_match_status} / ${row.image_small_url ? "image" : "no image"}`,
    );
  }
  if (rows.length > 10) console.log(`  ...${rows.length - 10} more`);

  if (withImage.length === 0) {
    console.error("\nNo rows with images — fix manifest or TCGdex connectivity.");
    process.exit(1);
  }

  if (!apply) {
    console.log("\nDry run only. Rerun with --apply to upsert.");
    return;
  }
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let total = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from("tcg_catalog_localized_artwork").upsert(chunk, {
      onConflict: "franchise,base_catalog_id,language,localized_catalog_id,printed_number",
    });
    if (error) throw new Error(error.message);
    total += chunk.length;
  }
  console.log(`Upserted ${total} Japanese artwork overlay row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
