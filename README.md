# PGT Collectibles

Production app: **[Alpha1](./Alpha1/)** — Next.js Pokémon TCG scanner with Clerk auth, Supabase, Stripe billing, and vision/market enrichment.

`PGTVision/` is a **local-only** V1 reference (gitignored). Do not commit it.

## Quick start

```bash
cd Alpha1
npm install
cp .env.example .env.local
# Edit .env.local, then:
npm run dev
```

Open http://localhost:3002/scanner

## First production deploy

1. `cd Alpha1 && npm run db:verify` (apply migrations if needed — see `docs/supabase-production-setup.md`)
2. Import `Alpha1/.env.production` on Vercel (Production environment)
3. Deploy with **Root Directory** = `Alpha1`, **Framework** = Next.js (no repo-root `vercel.json`), then **Redeploy** if you see a settings mismatch warning
4. Configure Clerk + Stripe webhooks to your live domain

Full checklist: [Alpha1/docs/step-2-staging-deploy.md](./Alpha1/docs/step-2-staging-deploy.md)

## Workspace scripts (from repo root)

| Command | Action |
|---------|--------|
| `npm run dev` | Start Alpha1 dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
