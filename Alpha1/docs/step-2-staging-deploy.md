# Step 2 — Staging deploy (test Clerk + test Stripe)

Complete **Step 1** first (`npm run db:verify` → all OK).

## 2a. Finish Step 1 (if not done)

1. Supabase → **Project Settings → Database** → copy **Database password**
2. In `.env.local`: `SUPABASE_DB_PASSWORD=...`
3. Run:

```bash
npm run db:apply
npm run db:verify
```

## 2b. Staging host (Vercel recommended)

1. Push repo to GitHub
2. [vercel.com](https://vercel.com) → **Import** → root directory `Alpha1`
3. Framework: **Next.js**
4. Add **Environment Variables** (Preview + Production for staging branch):

   **Preview:** copy test keys from `Alpha1/.env.example` (pk_test_ / sk_test_).  
   **Production:** import `Alpha1/.env.production` → **VERCEL_IMPORT** block (pk_live_ / sk_live_).

| Variable | Staging value |
|----------|----------------|
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-STAGING.vercel.app` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `CLERK_SECRET_KEY` | `sk_test_...` |
| `CLERK_WEBHOOK_SECRET` | staging webhook `whsec_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/liquid-scan` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/liquid-scan` |
| `NEXT_PUBLIC_SUPABASE_URL` | same as local |
| `SUPABASE_SERVICE_ROLE_KEY` | same as local |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | staging Stripe webhook `whsec_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| Vision keys | `GROQ_API_KEY`, `OPENROUTER_API_KEY`, etc. |

5. Deploy

## 2c. Clerk staging webhook

1. Clerk Dashboard → **Webhooks** → Add endpoint
2. URL: `https://YOUR-STAGING.vercel.app/api/webhooks/clerk`
3. Events: `user.created`, `user.updated`, `user.deleted`
4. Copy signing secret → Vercel `CLERK_WEBHOOK_SECRET` → redeploy

## 2d. Stripe staging webhook

1. Stripe **Test mode** → Developers → Webhooks
2. URL: `https://YOUR-STAGING.vercel.app/api/billing/webhook`
3. Event: `checkout.session.completed`
4. Copy signing secret → Vercel `STRIPE_WEBHOOK_SECRET` → redeploy

## 2e. Smoke test on staging URL

- [ ] Sign up / sign in → `/liquid-scan`
- [ ] Scan one image → usage increments
- [ ] `/usage` loads; checkout opens
- [ ] Test payment `4242 4242 4242 4242` → Pro or bonus scans in Supabase `app_users`

## Next: Step 3

Swap to **live** Clerk + **live** Stripe keys on production domain (same checklist, live mode).
