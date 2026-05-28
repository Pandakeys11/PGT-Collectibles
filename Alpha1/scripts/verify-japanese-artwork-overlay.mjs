/**
 * Safety checks for the Japanese artwork overlay path.
 * Verifies that localized artwork is isolated from canonical catalog rows.
 */
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label}: missing ${expected}`);
  }
}

function assertNotIncludes(text, unexpected, label) {
  if (text.includes(unexpected)) {
    throw new Error(`${label}: unexpected ${unexpected}`);
  }
}

const migration = read("supabase/migrations/202605280002_tcg_catalog_localized_artwork.sql");
assertIncludes(migration, "create table if not exists public.tcg_catalog_localized_artwork", "migration table");
assertIncludes(migration, "base_catalog_id", "migration base link");
assertIncludes(migration, "english_fallback", "migration fallback status");
assertNotIncludes(migration.toLowerCase(), "alter table public.tcg_catalog_cards", "migration isolation");

const helper = read("src/lib/catalog/localized-artwork.ts");
assertIncludes(helper, 'from("tcg_catalog_localized_artwork")', "helper overlay table");
assertIncludes(helper, "englishFallbackResolution", "helper fallback");
assertIncludes(helper, "isOldBackPrintedNo", "helper old-back guard");
assertNotIncludes(helper, 'from("tcg_catalog_cards")', "helper does not query canonical cards");

const enrichRoute = read("src/app/api/scan/enrich/route.ts");
assertIncludes(enrichRoute, "resolveLocalizedCatalogArtwork", "enrich route resolver");
assertIncludes(enrichRoute, "catalogImageSourceLabel", "enrich route source label");

const candidatesRoute = read("src/app/api/scan/catalog-candidates/route.ts");
assertIncludes(candidatesRoute, "resolveLocalizedCatalogArtwork", "candidate route resolver");
assertIncludes(candidatesRoute, "catalogImageNeedsReview", "candidate route review flag");

const contextBuilder = read("src/lib/scan/context-builder.ts");
assertIncludes(contextBuilder, "catalogImageSource", "context source field");
assertIncludes(contextBuilder, "catalogImageNeedsReview", "context review field");

console.log("Japanese artwork overlay safety checks passed.");
