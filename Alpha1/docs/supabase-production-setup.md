# Supabase production setup (Step 1)

Apply all migrations to your **production** Supabase project before deploying the app with live Clerk/Stripe.

## Migration order

| # | File | Purpose |
|---|------|---------|
| 1 | `202605180001_auth_profiles_usage.sql` | Users, profiles, scans, usage metering |
| 2 | `202605180002_companion.sql` | Companion game tables |
| 3 | `202605190001_billing_pro_bonus.sql` | Pro plan, `bonus_scans`, updated limits |
| 4 | `202605190002_master_admin_billing.sql` | `add_bonus_scans`, master admin email sync |
| 5 | `202605200001_pokemon_sprite_assets.sql` | Pokémon sprite catalog |

Migrations are idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) where possible.

## Option A — Supabase CLI

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

## Option B — SQL Editor (one paste)

If `db:verify` shows only the **last four** migrations missing (auth already OK):

1. [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**
2. Open `supabase/apply-pending-migrations.sql` (run `node scripts/build-pending-sql.mjs` to regenerate)
3. Paste entire file → **Run**

Or run each file under `supabase/migrations/` in order (table above).

## Apply pending migrations (automated)

Add to `.env.local`:

```env
SUPABASE_DB_PASSWORD=your-database-password
```

Then:

```bash
npm run db:apply
npm run db:verify
```

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

- Proceed to **Step 2**: deploy staging with test Clerk + test Stripe and verify webhooks.
