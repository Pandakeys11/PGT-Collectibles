/**
 * Option B — sync companion roster sprites to Supabase Storage + DB manifest.
 *
 * Prereqs:
 *   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - Migration `202605200001_pokemon_sprite_assets.sql` applied (or script still uploads + writes JSON)
 *
 * Usage:
 *   npm run sprites:sync              # dry-run
 *   npm run sprites:upload            # fetch Showdown + PokeAPI art, upload, write manifest
 *   npm run sprites:upload -- --manifest-only   # regenerate public/companion-sprite-manifest.json from DB
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const upload = process.argv.includes("--upload");
const manifestOnly = process.argv.includes("--manifest-only");
const BUCKET = "pokemon-sprites";
const CACHE_CONTROL = "public, max-age=86400, immutable";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

const rosterSrc = readFileSync(path.join(root, "src/lib/companion/pokemon-roster.ts"), "utf8");
const entries = [];
for (const match of rosterSrc.matchAll(
  /id:\s*(\d+),\s*name:\s*"([^"]+)",\s*slug:\s*"([^"]+)"/g,
)) {
  entries.push({ id: Number(match[1]), name: match[2], slug: match[3] });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const cdnBase = `${url.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}`;
const manifestPath = path.join(root, "public", "companion-sprite-manifest.json");

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function showdownUrl(slug) {
  return `https://play.pokemonshowdown.com/sprites/ani/${slug}.gif`;
}

function pokeArtworkUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (exists) return true;

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (error) {
    console.warn(`Could not create bucket "${BUCKET}":`, error.message);
    console.warn("Create a public bucket manually in Supabase Storage, then re-run --upload");
    return false;
  }
  console.log(`Created public bucket "${BUCKET}"`);
  return true;
}

function writeManifest(manifestEntries) {
  const manifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    cdnBase,
    entries: manifestEntries,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`\nWrote ${manifestPath} (${manifestEntries.length} entries)`);
}

async function loadDbManifest() {
  const { data, error } = await supabase
    .from("pokemon_sprite_assets")
    .select(
      "national_id,showdown_slug,has_ani,has_artwork,ani_public_url,artwork_public_url",
    )
    .order("national_id", { ascending: true });

  if (error) {
    console.warn("DB read skipped:", error.message);
    return null;
  }

  const byId = new Map(data.map((row) => [row.national_id, row]));
  return entries.map((entry) => {
    const row = byId.get(entry.id);
    return {
      nationalId: entry.id,
      slug: entry.slug,
      name: entry.name,
      hasAni: Boolean(row?.has_ani),
      hasArtwork: Boolean(row?.has_artwork),
      aniUrl: row?.ani_public_url ?? null,
      artworkUrl: row?.artwork_public_url ?? null,
    };
  });
}

if (manifestOnly) {
  const manifestEntries = await loadDbManifest();
  if (!manifestEntries) {
    console.error("Could not load manifest from DB");
    process.exit(1);
  }
  writeManifest(manifestEntries);
  process.exit(0);
}

console.log(
  upload
    ? `Uploading ${entries.length} sprites to bucket "${BUCKET}"…\n`
    : `Dry-run: would sync ${entries.length} sprites to "${BUCKET}" (npm run sprites:upload to execute)\n`,
);

const manifestEntries = [];

if (upload) {
  const bucketOk = await ensureBucket();
  if (!bucketOk) process.exit(1);
}

for (const entry of entries) {
  const aniPath = `ani/${entry.id}.gif`;
  const artPath = `artwork/${entry.id}.png`;
  const aniPublic = `${cdnBase}/${aniPath}`;
  const artPublic = `${cdnBase}/${artPath}`;

  if (!upload) {
    console.log(`  #${entry.id} ${entry.name} → ${aniPath}, ${artPath}`);
    continue;
  }

  let hasAni = false;
  try {
    const res = await fetch(showdownUrl(entry.slug));
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const { error } = await supabase.storage.from(BUCKET).upload(aniPath, buf, {
        contentType: "image/gif",
        cacheControl: CACHE_CONTROL,
        upsert: true,
      });
      if (!error) hasAni = true;
      else console.warn(`  ani upload ${entry.name}:`, error.message);
    }
  } catch (err) {
    console.warn(`  ani fetch ${entry.name}:`, err instanceof Error ? err.message : err);
  }

  let hasArtwork = false;
  try {
    const res = await fetch(pokeArtworkUrl(entry.id));
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const { error } = await supabase.storage.from(BUCKET).upload(artPath, buf, {
        contentType: "image/png",
        cacheControl: CACHE_CONTROL,
        upsert: true,
      });
      if (!error) hasArtwork = true;
    }
  } catch {
    /* optional */
  }

  const { error: rowError } = await supabase.from("pokemon_sprite_assets").upsert({
    national_id: entry.id,
    showdown_slug: entry.slug,
    has_ani: hasAni,
    has_artwork: hasArtwork,
    ani_storage_path: hasAni ? aniPath : null,
    artwork_storage_path: hasArtwork ? artPath : null,
    ani_public_url: hasAni ? aniPublic : null,
    artwork_public_url: hasArtwork ? artPublic : null,
    source: hasAni ? "showdown" : "pokeapi-artwork",
    updated_at: new Date().toISOString(),
  });

  if (rowError) {
    console.warn(`  db ${entry.name}:`, rowError.message);
  } else {
    console.log(`  synced #${entry.id} ${entry.name} (ani=${hasAni}, art=${hasArtwork})`);
  }

  manifestEntries.push({
    nationalId: entry.id,
    slug: entry.slug,
    name: entry.name,
    hasAni,
    hasArtwork,
    aniUrl: hasAni ? aniPublic : null,
    artworkUrl: hasArtwork ? artPublic : null,
  });
}

if (upload) {
  writeManifest(manifestEntries);
} else {
  console.log(`
Next steps:
  1. Apply migration: npm run db:push  (or paste SQL in Supabase dashboard)
  2. Run: npm run sprites:upload
  3. Add to .env.local:
       NEXT_PUBLIC_PGT_SPRITE_CDN=${cdnBase}
       NEXT_PUBLIC_COMPANION_SPRITES_HOSTED=1
  4. Restart dev server and verify companion + battle arena sprites
`);
}
