# PGT Vision Alpha1

Production Next.js app: verify-first TCG scanning (Liquid Scan), master catalog, market FMV, cert registry, and saved sessions.

**Monorepo note:** Git root is `PGT_Vision/`; Vercel project root is **this folder** (`Alpha1/`).

## Repository structure

```
Alpha1/
├── src/
│   ├── app/              # App Router — pages + API routes
│   ├── components/       # UI by domain (scanner-chat, catalog, pokedex, …)
│   ├── lib/              # Business logic (scan, market, catalog, ai, supabase)
│   ├── hooks/            # Shared React hooks
│   ├── styles/           # Feature CSS modules
│   └── data/             # Static manifests (pokedex)
├── scripts/              # CLI — catalog sync, ingest, verify (see scripts/README.md)
├── supabase/
│   └── migrations/       # SQL migrations (18 files, apply via npm run db:*)
├── docs/                 # Operator documentation (index: docs/README.md)
├── public/               # Static assets
├── .env.example          # Local env template (tracked)
└── .env.production.example
```

Product naming: **Liquid Scan** (route `/liquid-scan`) uses `scanner-chat` component/lib folders — legacy `/scanner` redirects.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` (Clerk, Supabase, Stripe, at least one vision API key). See `.env.example` section headers.

## Development

```bash
npm run dev          # http://localhost:3002
npm run dev:clean    # clear .next then dev (recommended after pulls)
npm run dev:tunnel   # dev + ngrok for Clerk webhooks
```

## Production checks

Run from `Alpha1/` before deploy:

```bash
npm run lint
npm run build
npm run db:verify
npm run verify:catalog-health
npm run verify:card-display
```

With dev server running (`npm run dev`):

```bash
npm run smoke:scan
npm run smoke:enrich
```

## Key scripts

| Script | Purpose |
|--------|---------|
| `db:verify` / `db:apply` / `db:push` | Supabase schema |
| `db:build-pending` | Regenerate SQL paste bundle |
| `catalog:sync:pokemon` | TCG catalog sync |
| `catalog:backfill:prices` / `catalog:backfill:psa10` | Bulk FMV / PSA 10 comps |
| `market:ingest` / `platform:nightly` | Market intel + nightly jobs |
| `setup:brightdata` / `verify:brightdata` | Bright Data cert / pop harvest |
| `verify:ebay-sold` | eBay sold pipeline smoke |
| `sprites:verify` / `sprites:upload` | Companion sprites |

Full index: [scripts/README.md](./scripts/README.md).

## Documentation

| Resource | Purpose |
|----------|---------|
| [docs/README.md](./docs/README.md) | Doc index |
| [docs/repo-audit.md](./docs/repo-audit.md) | Health checklist + layout |
| [docs/supabase-production-setup.md](./docs/supabase-production-setup.md) | Database migrations |
| [docs/step-2-staging-deploy.md](./docs/step-2-staging-deploy.md) | Vercel deploy |

## Deploy

Vercel **Root Directory:** `Alpha1`. Import production env from `.env.production.example` / your `.env.production` `VERCEL_IMPORT` block. Never commit real secrets.
