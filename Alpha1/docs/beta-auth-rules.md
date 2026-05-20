# Beta Auth, Profiles, Saved Cards, and Usage Rules

## Access Model

All scanner usage requires a signed-in Clerk user. Catalog browsing can remain public, but scan extraction, scan chat, scan enrichment, saved cards, profile, usage, and admin pages are protected.

Clerk middleware configuration lives in `src/proxy.ts` and is exported from `src/middleware.ts` (required by Clerk — do not use a root-level `middleware.ts` re-export).

## Plans

| Plan | Assignment | Daily Scans | Monthly Scans |
| --- | --- | ---: | ---: |
| `beta_pro` | First 500 synced users | 80 | 3000 |
| `pro` | Paid subscription (Stripe) | 80 | 3000 |
| `trial` | Free tier (default) | — | 15 |
| `admin` | Manual database assignment | unlimited | unlimited |
| `suspended` | Manual abuse/fraud state | 0 | 0 |

Limits are defined in `src/lib/auth/plans.ts` and enforced in `consume_scan_credits` (see `supabase/migrations/202605200002_free_tier_monthly_scans.sql` for free-tier monthly-only caps). Purchased scan packs add to `app_users.bonus_scans` and are consumed after plan limits are exhausted.

The first-500 rule is enforced in the Supabase `sync_clerk_user` function with a transaction lock. Do not assign beta access in frontend code.

## Credit Rules

- One image or crop sent to `/api/vision/extract` costs one scan credit.
- Manual edits, CSV/JSON exports, catalog browsing, profile views, and saved-list views do not cost credits.
- Credits are reserved before provider calls.
- Pro and beta_pro plans have a daily cap (resets by UTC date) and a monthly cap (resets on the 1st UTC).
- Free tier (`trial`) has **no daily cap** — only **15 scan credits per calendar month** (UTC).
- Monthly counters reset on the first UTC day of each month.
- Rate-limit blocks are recorded in `usage_ledger`.
- Bonus scan packs never expire; pricing lives in `src/lib/billing/pricing.ts`.
- **Early adopter promo:** the first **200** accounts to sign up receive **+50 bonus scans** automatically at signup (`early_promo_number` on `app_users`). Constants in `src/lib/auth/promotions.ts`; enforced in `sync_clerk_user`.
- Scanner UI shows live quota via `/api/account/me`; upgrade at `/usage`.

## Data Rules

- Clerk is the identity provider.
- Supabase is the app database.
- `app_users.clerk_user_id` is the stable identity link.
- `profiles` stores app-specific profile fields.
- `scan_sessions` stores a saved scan event.
- `extracted_cards` stores the master saved card list.
- `usage_ledger` is the audit trail.
- `usage_counters` is the fast limit-check table.

## Required Environment

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Clerk Webhook

Configure a Clerk webhook for:

- `user.created`
- `user.updated`
- `user.deleted`

Webhook target:

```text
/api/webhooks/clerk
```

Use the Clerk webhook signing secret as `CLERK_WEBHOOK_SECRET`.

## Supabase Migration

Run:

```bash
supabase db push
```

or apply all migrations in order (see `docs/supabase-production-setup.md`):

```bash
npm run db:push    # Supabase CLI linked
npm run db:verify  # confirm schema
```

## Launch Checklist

- Clerk sign-up/sign-in works.
- Clerk webhook creates a row in `app_users`.
- First created users receive `beta_pro` and a `beta_number`.
- User 501 receives `trial`.
- `/scanner` redirects anonymous users to sign in.
- `/api/vision/extract` rejects anonymous users.
- `/api/vision/extract` returns `429` after usage is exhausted.
- Saving a scanner session creates one `scan_sessions` row and matching `extracted_cards` rows.
- `/saved` shows the saved rows for the signed-in user.
