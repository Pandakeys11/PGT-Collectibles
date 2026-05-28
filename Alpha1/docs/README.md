# Alpha1 documentation

Operator and contributor index. Env templates: **`.env.example`** (local), **`.env.production.example`** (Vercel Production import block).

## Start here

| Doc | Purpose |
|-----|---------|
| [repo-audit.md](./repo-audit.md) | Repo layout, health checklist, migration shortcuts |
| [supabase-production-setup.md](./supabase-production-setup.md) | Database migrations (`npm run db:*`) |
| [step-2-staging-deploy.md](./step-2-staging-deploy.md) | Vercel Preview + Production deploy |
| [../scripts/README.md](../scripts/README.md) | CLI scripts index (`npm run` + dev probes) |

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
| [set-insight-audit.md](./set-insight-audit.md) | Set insight API/UI guard rails |
| [pokegrade-integration.md](./pokegrade-integration.md) | Optional PokeGrade API HUD |

## Auth, billing, deploy

| Doc | Purpose |
|-----|---------|
| [beta-auth-rules.md](./beta-auth-rules.md) | Clerk, plans, master admin, billing rules |
| [github-setup.md](./github-setup.md) | GitHub / CI basics |
| [vercel-404-fix.md](./vercel-404-fix.md) | Vercel root-directory troubleshooting |
| [groq-paid-testing.md](./groq-paid-testing.md) | Groq-only / provider tuning for dev |

## Market, registry, ingest

| Doc | Purpose |
|-----|---------|
| [cert-registry-data.md](./cert-registry-data.md) | Cert registry sources overview |
| [CERT_REGISTRY_FALLBACKS.md](./CERT_REGISTRY_FALLBACKS.md) | Provider fallback chain (GemRate, PSA, Bright Data, …) |
| [brightdata-pop-harvest.md](./brightdata-pop-harvest.md) | Bright Data pop harvest + setup |
| [brightdata-free-tier.md](./brightdata-free-tier.md) | Bright Data trial caps and budget |
| [graded-market-harvest.md](./graded-market-harvest.md) | Graded sold-comp harvest |
| [catalog-psa10-backfill.md](./catalog-psa10-backfill.md) | PSA 10 catalog comp backfill job |
| [nightly-cron.md](./nightly-cron.md) | Nightly platform / market ingest cron |
| [PGT_PLATFORM_PHASES.md](./PGT_PLATFORM_PHASES.md) | Platform phase roadmap |

## Assets & misc

| Doc | Purpose |
|-----|---------|
| [companion-sprites.md](./companion-sprites.md) | Companion sprite CDN pipeline |

## Related npm scripts

| Script | Doc / notes |
|--------|-------------|
| `db:verify`, `db:apply`, `db:push`, `db:build-pending` | [supabase-production-setup.md](./supabase-production-setup.md) |
| `db:apply:set-insights` | Set insight table (`202605280003`) |
| `catalog:backfill:prices`, `catalog:backfill:psa10` | [nightly-cron.md](./nightly-cron.md), [catalog-psa10-backfill.md](./catalog-psa10-backfill.md) |
| `catalog:sync:justtcg-prices`, `verify:justtcg` | JustTCG price hydrate |
| `market:ingest`, `platform:nightly` | [nightly-cron.md](./nightly-cron.md) |
| `setup:brightdata`, `verify:brightdata` | [brightdata-pop-harvest.md](./brightdata-pop-harvest.md) |
| `smoke:scan`, `smoke:enrich`, `smoke:enrich-batch` | [scan-pipeline-audit.md](./scan-pipeline-audit.md) |
| `catalog:refresh:pokemon-japanese-artwork` | JPN overlay manifest + ticker verify |
| `verify:catalog-health` | Master catalog DB coverage |
