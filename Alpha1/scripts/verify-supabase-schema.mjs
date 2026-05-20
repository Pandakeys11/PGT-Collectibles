/**
 * Verifies production-ready Supabase schema for PGT Vision Alpha1.
 * Usage: npm run db:verify
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./load-env-local.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const checks = [];

function pass(name, detail) {
  checks.push({ ok: true, name, detail });
}

function fail(name, detail) {
  checks.push({ ok: false, name, detail });
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select("*").limit(1);
  if (!error) return true;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("does not exist") || msg.includes("schema cache")) return false;
  return true;
}

async function columnExists(supabase, table, column) {
  const { error } = await supabase.from(table).select(column).limit(1);
  if (!error) return true;
  const msg = (error.message ?? "").toLowerCase();
  return !msg.includes(column.toLowerCase()) && !msg.includes("column");
}

async function rpcExists(supabase, fn, args) {
  const { error } = await supabase.rpc(fn, args);
  if (!error) return true;
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("could not find the function") || msg.includes("function") && msg.includes("does not exist")) {
    return false;
  }
  return true;
}

async function main() {
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  console.log(`Verifying Supabase: ${url}\n`);
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const coreTables = [
    "app_users",
    "profiles",
    "scan_sessions",
    "extracted_cards",
    "usage_ledger",
    "usage_counters",
  ];
  for (const table of coreTables) {
    if (await tableExists(supabase, table)) pass(`table:${table}`, "present");
    else fail(`table:${table}`, "missing — run 202605180001_auth_profiles_usage.sql");
  }

  if (await columnExists(supabase, "app_users", "early_promo_number")) {
    pass("column:app_users.early_promo_number", "present");
  } else {
    fail("column:app_users.early_promo_number", "missing — run 202605200003_early_user_promo.sql");
  }

  if (await columnExists(supabase, "app_users", "bonus_scans")) {
    pass("column:app_users.bonus_scans", "present");
  } else {
    fail("column:app_users.bonus_scans", "missing — run 202605190001_billing_pro_bonus.sql");
  }

  if (await tableExists(supabase, "user_companions")) {
    pass("table:user_companions", "present");
  } else {
    fail("table:user_companions", "missing — run 202605180002_companion.sql");
  }

  if (await tableExists(supabase, "pokemon_sprite_assets")) {
    pass("table:pokemon_sprite_assets", "present");
  } else {
    fail("table:pokemon_sprite_assets", "missing — run 202605200001_pokemon_sprite_assets.sql");
  }

  const fakeUser = "00000000-0000-0000-0000-000000000001";
  if (await rpcExists(supabase, "sync_clerk_user", {
    p_clerk_user_id: "verify-schema-probe",
    p_email: null,
    p_display_name: null,
    p_avatar_url: null,
  })) {
    pass("rpc:sync_clerk_user", "callable");
  } else {
    fail("rpc:sync_clerk_user", "missing — run auth migration");
  }

  if (await rpcExists(supabase, "add_bonus_scans", { p_app_user_id: fakeUser, p_credits: 1 })) {
    pass("rpc:add_bonus_scans", "callable");
  } else {
    fail("rpc:add_bonus_scans", "missing — run 202605190002_master_admin_billing.sql");
  }

  const { data: creditProbe, error: creditErr } = await supabase.rpc("consume_scan_credits", {
    p_app_user_id: fakeUser,
    p_credits: 1,
    p_route: "/verify-schema",
    p_metadata: {},
  });
  if (creditErr) {
    const msg = creditErr.message ?? "";
    if (msg.toLowerCase().includes("function")) {
      fail("rpc:consume_scan_credits", "missing — run billing migrations");
    } else {
      pass("rpc:consume_scan_credits", `callable (${msg.slice(0, 60)})`);
    }
  } else {
    const row = Array.isArray(creditProbe) ? creditProbe[0] : creditProbe;
    if (row && "bonus_scans" in row) {
      pass("rpc:consume_scan_credits", "returns bonus_scans (billing migration applied)");
    } else {
      fail("rpc:consume_scan_credits", "outdated — re-run 202605190001_billing_pro_bonus.sql");
    }
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    const icon = c.ok ? "OK" : "FAIL";
    console.log(`[${icon}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }

  console.log("");
  if (failed.length === 0) {
    console.log("All checks passed. Supabase is ready for step 2 (staging deploy).");
    process.exit(0);
  }

  console.log(`${failed.length} check(s) failed. Apply migrations in order:\n`);
  console.log("  1. supabase/migrations/202605180001_auth_profiles_usage.sql");
  console.log("  2. supabase/migrations/202605180002_companion.sql");
  console.log("  3. supabase/migrations/202605190001_billing_pro_bonus.sql");
  console.log("  4. supabase/migrations/202605190002_master_admin_billing.sql");
  console.log("  5. supabase/migrations/202605200001_pokemon_sprite_assets.sql");
  console.log("  6. supabase/migrations/202605200002_free_tier_monthly_scans.sql");
  console.log("  7. supabase/migrations/202605200003_early_user_promo.sql");
  console.log("\nThen run: npm run db:verify");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
