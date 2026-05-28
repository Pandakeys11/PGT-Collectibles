# Supabase production setup (Step 1)

Apply all migrations to your **production** Supabase project before deploying the app with live Clerk/Stripe.

## Migration order (18 files)

Apply in filename sort order under `supabase/migrations/`:

| # | File | Purpose |
|---|------|---------|
| 1 | `202605180001_auth_profiles_usage.sql` | Users, profiles, scans, usage metering |
| 2 | `202605180002_companion.sql` | Companion game tables |
| 3 | `202605190001_billing_pro_bonus.sql` | Pro plan, `bonus_scans`, updated limits |
| 4 | `202605190002_master_admin_billing.sql` | `add_bonus_scans`, master admin email sync |
| 5 | `202605200001_pokemon_sprite_assets.sql` | Pokémon sprite catalog |
| 6 | `202605200002_free_tier_monthly_scans.sql` | Free tier monthly scan limits |
| 7 | `202605200003_early_user_promo.sql` | Early-user promo |
| 8 | `202605200004_early_user_promo_ledger.sql` | Promo ledger |
| 9 | `202605200005_early_user_promo_ledger_apply.sql` | Promo ledger apply |
| 10 | `202605200006_early_user_promo_bonus_50.sql` | Promo bonus adjustment |
| 11 | `202605210001_market_snapshots.sql` | Market snapshot tables |
| 12 | `202605220001_tcg_catalog.sql` | Master catalog (`tcg_catalog_*`) |
| 13 | `202605230001_pgt_registry.sql` | Registry / slab tables |
| 14 | `202605260001_companion_starter_rerolls.sql` | Companion starter rerolls |
| 15 | `202605270001_tcg_catalog_lookup_indexes.sql` | Catalog lookup indexes |
| 16 | `202605280001_pgt_market_intel.sql` | Market intel persist (`pgt_market_comps`, …) |
| 17 | `202605280002_tcg_catalog_localized_artwork.sql` | JPN artwork overlays |
| 18 | `202605280003_tcg_catalog_set_insights.sql` | Set insight cache |

Migrations are idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) where possible.

After adding a new migration file, run `npm run db:build-pending` and commit the updated `supabase/apply-pending-migrations.sql` if you use the paste bundle workflow.

## Option A — Supabase CLI (recommended)

```bash
cd Alpha1
npx supabase login
npx supabase link --project-ref YOUR_REF
```

`YOUR_REF` is the ID in your project URL: `https://YOUR_REF.supabase.co`

```bash
npm run db:push
npm run db:verify
```

## Option B — Incremental apply (automated)

Add to `.env.local`:

```env
SUPABASE_DB_PASSWORD=your-database-password
```

Then:

```bash
npm run db:apply      # incremental — preferred for prod updates
npm run db:verify
```

## Option C — SQL Editor (one paste)

For greenfield or when CLI/incremental is unavailable:

1. [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**
2. Regenerate bundle: `npm run db:build-pending`
3. Open `supabase/apply-pending-migrations.sql` → paste entire file → **Run**

Or run each file under `supabase/migrations/` in the table order above.

**Note:** `npm run db:apply:bundle` applies the same monolithic SQL file via Postgres (not the Supabase SQL Editor UI).

## Single-migration hotfixes

| Script | Migration |
|--------|-----------|
| `npm run db:apply:catalog-indexes` | `202605270001_tcg_catalog_lookup_indexes.sql` |
| `npm run db:apply:market-intel` | `202605280001_pgt_market_intel.sql` |
| `npm run db:apply:localized-artwork` | `202605280002_tcg_catalog_localized_artwork.sql` |
| `npm run db:apply:set-insights` | `202605280003_tcg_catalog_set_insights.sql` |

## Verify

```bash
npm run db:verify
```

All lines should show `[OK]`. Any `[FAIL]` tells you which migration to run.

## Production env (hosting only)

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # Settings → API → service_role (secret)
```

Never expose the service role key to the browser.

## After Step 1

When `npm run db:verify` passes on the production project URL/keys:

- Proceed to **Step 2**: deploy staging with test Clerk + test Stripe and verify webhooks — [step-2-staging-deploy.md](./step-2-staging-deploy.md).
