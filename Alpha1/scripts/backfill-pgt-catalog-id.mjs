#!/usr/bin/env node
/**
 * Phase A — backfill pgt_card_identities.catalog_id from saved extracted_cards
 * that already have a confirmed catalog lock in market_snapshot_json or context.
 *
 * Usage:
 *   node scripts/backfill-pgt-catalog-id.mjs
 *   node scripts/backfill-pgt-catalog-id.mjs --dry-run
 */
import { createClient } from "@supabase/supabase-js";

const dryRun = process.argv.includes("--dry-run");

function env(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

function catalogIdFromRow(row) {
  const snap = row.market_snapshot_json;
  if (snap && typeof snap === "object" && typeof snap.catalogId === "string") {
    return snap.catalogId.trim() || null;
  }
  return null;
}

async function main() {
  const { data: cards, error } = await supabase
    .from("extracted_cards")
    .select("id,pgt_card_identity_id,name,set_name,card_number,market_snapshot_json")
    .not("pgt_card_identity_id", "is", null)
    .limit(5000);

  if (error) throw new Error(error.message);

  let updated = 0;
  let skipped = 0;

  for (const row of cards ?? []) {
    const catalogId = catalogIdFromRow(row);
    if (!catalogId) {
      skipped += 1;
      continue;
    }

    const { data: identity, error: idErr } = await supabase
      .from("pgt_card_identities")
      .select("id,catalog_id")
      .eq("id", row.pgt_card_identity_id)
      .maybeSingle();

    if (idErr || !identity) {
      skipped += 1;
      continue;
    }
    if (identity.catalog_id === catalogId) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] identity ${identity.id} ← catalog_id ${catalogId}`);
      updated += 1;
      continue;
    }

    const { error: upErr } = await supabase
      .from("pgt_card_identities")
      .update({ catalog_id: catalogId, updated_at: new Date().toISOString() })
      .eq("id", identity.id);

    if (upErr) {
      console.warn(`skip ${identity.id}: ${upErr.message}`);
      skipped += 1;
    } else {
      updated += 1;
    }
  }

  console.log(
    JSON.stringify({ dryRun, scanned: cards?.length ?? 0, updated, skipped }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
