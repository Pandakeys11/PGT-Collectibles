# PGT Vision Alpha1

Verify-first Pokémon TCG scanner: vision extract → catalog match → market FMV → saved sessions.

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` (Clerk, Supabase, Stripe, at least one vision API key). See `.env.example`.

## Development

```bash
npm run dev          # http://localhost:3002
npm run dev:tunnel   # dev + ngrok for Clerk webhooks
```

## Production checks

```bash
npm run lint
npm run build
npm run db:verify
npm run verify:card-display
```

## Key scripts

| Script | Purpose |
|--------|---------|
| `db:verify` / `db:apply` / `db:push` | Supabase schema |
| `db:probe` | Test Postgres connection string |
| `smoke:scan` / `smoke:enrich` / `smoke:enrich-batch` | API smoke tests (server running) |
| `market:ingest` / `platform:nightly` | Market intel + nightly jobs |
| `setup:brightdata` / `verify:brightdata` | Bright Data cert / pop harvest |
| `catalog:sync:pokemon` | TCG catalog sync |
| `sprites:verify` / `sprites:upload` | Companion sprites |

## Docs

See [docs/README.md](./docs/README.md).

## Deploy

Vercel project root: **this folder** (`Alpha1`). Production env: `.env.production` → `VERCEL_IMPORT` block.
