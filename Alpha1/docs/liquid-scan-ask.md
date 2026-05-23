# Liquid Scan Ask (Liquid Vault Q&A)

**Liquid Vault** is the product name for PGT’s AI layer (branding assets under `/branding/liquid_vault_*`). In the app, Ask runs through:

| Surface | API | When to use |
|--------|-----|-------------|
| **Liquid Scan** composer (text only, no images) | `POST /api/scan/liquid-chat` | Session-wide or focused-card Q&A after a scan |

Liquid Scan Ask uses **grounded context**: `buildNarrationLlmContext` + a **session brief digest** built from in-session FMV, comps, and verification (not invented prices). Legacy command-center routes (`/scanner`, `/api/scan/narrate`, `/api/scan/chat`) were removed — use Liquid Scan only.

The system persona is defined in `src/lib/scanner-chat/liquid-vault-guru-rules.ts` (PGT Liquid Vault AI — TCG, sports, raw/graded/sealed, print-edition-aware FMV).

## Research tiers (free vs Pro)

Research runs **before** the streamed answer. Steps are split so **paid API spend** only runs for Pro members (`pro`, `beta_pro`, `admin`).

### Free tier (all signed-in users)

| Order | Step | API / cost |
|------|------|------------|
| 1 | Session scan comps + desk brief context | $0 |
| 2 | Cert registry lookup (PSA/CGC/BGS from question or focus card) | $0 scrape |
| 3 | Platform hub links (eBay search URL, Card Ladder, ALT, …) | $0 |
| 4 | **Gemini Google Search** markdown web brief (general questions) | `GEMINI_API_KEY` (Google free quota) |
| 5 | DuckDuckGo snippet search | $0 |
| 6 | Gemini grounding → structured comp rows (fallback) | `GEMINI_API_KEY` |

### Pro tier (paid members only)

| Order | Step | API / cost |
|------|------|------------|
| 1 | **OpenRouter market model** open-web brief (e.g. `perplexity/sonar`) | OpenRouter credits |
| 2 | eBay sold harvest (`harvestGradedMarketEvidence`) | `EBAY_FINDING_APP_ID` / `EBAY_CLIENT_ID` |
| 3 | Full market enrich (`researchCardMarket`) | Keyed marketplace adapters |

Pro users still get **free-tier steps** as fallback (e.g. Gemini brief if Sonar fails).

Disable all Pro research globally (e.g. before API credits are loaded):

```env
LIQUID_ASK_PRO_RESEARCH=0
```

## Implementation roadmap (in order)

1. **Done** — Tier split in `liquid-ask-research.ts` + `liquid-ask-research-tier.ts`
2. **Done** — Free Gemini web brief + Pro OpenRouter brief in `liquid-ask-web-brief.ts`
3. **Next** — Optional `TAVILY_API_KEY` (1k/mo free) as DuckDuckGo fallback in free tier
4. **When funded** — Load OpenRouter credits; set `OPENROUTER_MARKET_MODEL=perplexity/sonar`; test Pro brief
5. **When funded** — Confirm eBay keys; test Pro harvest on scanned cards
6. **Later** — Groq `groq/compound` (paid web search ~$5/1k) — Pro-only alternate, not default
7. **Later** — UI: “Upgrade for eBay sold comps” chip when `proMarketSkipped` is true

## How Ask is triggered

1. User runs a scan (or loads a card from **Master catalog → Scan this card**).
2. User types a question in the composer **without** queued images.
3. `useScannerChat` → `sendLiquidAsk` → `/api/scan/liquid-chat` (SSE stream).

If images are queued, submit runs **vision scan** instead of Ask.

## What “up to date” means

- **Liquid Vault Ask** runs **live research** at question time (`researchedAt`, `todayUtc`).
- **Free**: Gemini search brief + DuckDuckGo + session comps.
- **Pro**: adds OpenRouter Sonar brief + eBay sold enrich when keys are configured.
- **Cert numbers** in the question (e.g. `PSA 12345678`) trigger registry + scoped searches.

## Environment

### Free Ask (minimum)

```env
FREE_TIER_ONLY=1
TEXT_PROVIDER_ORDER=groq,gemini,openrouter
GROQ_API_KEY=...
GROQ_TEXT_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=...
GEMINI_TEXT_MODEL=gemini-2.5-flash
```

### Pro Ask (when API credits are loaded)

```env
FREE_TIER_ONLY=0
OPENROUTER_API_KEY=...
OPENROUTER_MARKET_MODEL=perplexity/sonar
EBAY_FINDING_APP_ID=...   # or EBAY_CLIENT_ID
# LIQUID_ASK_PRO_RESEARCH=1   # default on; set 0 to disable Pro research until funded
```

### Health check

```bash
# Signed in
curl -s http://localhost:3002/api/scan/liquid-chat
```

Response includes `research.free` / `research.pro` step lists and which keys are configured.

## Verification checklist

### 1. Free user — general market question

1. Account on **trial** plan.
2. Ask: `Highest value card in Pokémon Base Set?`
3. Expect: status → Gemini/web comps → streamed answer (not upload tutorial).
4. Coverage banner: `researchTier: free`, `geminiBriefUsed` or snippet comps.

### 2. Pro user — same question (after OpenRouter funded)

1. Account on **pro** / **beta_pro**.
2. Same question → `proWebBriefUsed` when Sonar succeeds.

### 3. Free user — scanned card

1. Scan a card, ask FMV question.
2. Expect session comps; if eBay keys exist, note `proMarketSkipped` (no API eBay rows on free).

### 4. Pro user — scanned card (eBay configured)

1. Expect eBay sold rows in research panel when harvest succeeds.

## Focused vs session context

| `focusSpecimenId` | Context sent |
|-------------------|--------------|
| Set (selected card) | Full card JSON + **brief digest** for that card |
| Unset | Up to 12 cards + session totals + brief digests |

Select the card in the feed or intelligence panel before asking card-specific questions.
