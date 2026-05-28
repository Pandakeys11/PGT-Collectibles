# Alpha1 documentation

Index for operators and contributors. Env templates: **`.env.example`** (local), **`.env.production`** (Vercel Production import block).

## Core product

| Doc | Purpose |
|-----|---------|
| [app-routing.md](./app-routing.md) | App routes, legacy `/scanner` redirect |
| [liquid-scan-ask.md](./liquid-scan-ask.md) | Liquid Scan chat / Ask API |
| [scan-pipeline-audit.md](./scan-pipeline-audit.md) | Vision → catalog → market pipeline, Speed toggle, latency |
| [graded-slab-scan.md](./graded-slab-scan.md) | Graded lane, slab OCR, cert fields |
| [MULTI_FRANCHISE_SCANNING.md](./MULTI_FRANCHISE_SCANNING.md) | Non-Pokémon franchise scans |
| [master-catalog.md](./master-catalog.md) | Master catalog browser |
| [liquid-scan-master-catalog-audit.md](./liquid-scan-master-catalog-audit.md) | Catalog ↔ scan integration notes |
| [pokegrade-integration.md](./pokegrade-integration.md) | Optional PokeGrade API HUD |

## Auth, billing, deploy

| Doc | Purpose |
|-----|---------|
| [beta-auth-rules.md](./beta-auth-rules.md) | Clerk, plans, master admin, billing rules |
| [supabase-production-setup.md](./supabase-production-setup.md) | Database migrations (`npm run db:*`) |
| [step-2-staging-deploy.md](./step-2-staging-deploy.md) | Vercel Preview + Production deploy |
| [github-setup.md](./github-setup.md) | GitHub / CI basics |
| [vercel-404-fix.md](./vercel-404-fix.md) | Vercel root-directory troubleshooting |
| [groq-paid-testing.md](./groq-paid-testing.md) | Groq-only / provider tuning for dev |

## Market, registry, ingest

| Doc | Purpose |
|-----|---------|
| [cert-registry-data.md](./cert-registry-data.md) | Cert registry sources overview |
| [CERT_REGISTRY_FALLBACKS.md](./CERT_REGISTRY_FALLBACKS.md) | Provider fallback chain (GemRate, PSA, Bright Data, …) |
| [brightdata-pop-harvest.md](./brightdata-pop-harvest.md) | Bright Data pop harvest + setup |
| [graded-market-harvest.md](./graded-market-harvest.md) | Graded sold-comp harvest |
| [nightly-cron.md](./nightly-cron.md) | Nightly platform / market ingest cron |
| [PGT_PLATFORM_PHASES.md](./PGT_PLATFORM_PHASES.md) | Platform phase roadmap |

## Assets & misc

| Doc | Purpose |
|-----|---------|
| [companion-sprites.md](./companion-sprites.md) | Companion sprite CDN pipeline |
| [repo-audit.md](./repo-audit.md) | Repo layout, health checklist, migrations, gaps |

## Related npm scripts

| Script | Doc / notes |
|--------|-------------|
| `db:verify`, `db:apply`, `db:push` | [supabase-production-setup.md](./supabase-production-setup.md) |
| `market:ingest`, `platform:nightly` | [nightly-cron.md](./nightly-cron.md) |
| `setup:brightdata`, `verify:brightdata` | [brightdata-pop-harvest.md](./brightdata-pop-harvest.md) |
| `smoke:scan`, `smoke:enrich`, `smoke:enrich-batch` | [scan-pipeline-audit.md](./scan-pipeline-audit.md) |
| `catalog:refresh:pokemon-japanese-artwork` | JPN overlay manifest + ticker verify |
