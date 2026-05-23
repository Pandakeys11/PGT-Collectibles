# Paid Groq testing (credit-safe)

Use this profile when Groq billing is enabled and you want **one provider** for vision + chat without burning OpenRouter/Gemini/OpenAI credits on fallbacks.

## Groq console — allow these models

- `meta-llama/llama-4-scout-17b-16e-instruct` (vision / binder scans)
- `llama-3.1-8b-instant` (Liquid Ask + fast text)
- Optional: `llama-3.3-70b-versatile` (richer session reports; set `GROQ_TEXT_MODEL`)

## Recommended `.env.local` flags

```env
FREE_TIER_ONLY=1
GROQ_PRIMARY_ONLY=1

GROQ_API_KEY=gsk_...   # no quotes

GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_TEXT_MODEL=llama-3.1-8b-instant

VISION_PROVIDER_ORDER=groq
TEXT_PROVIDER_ORDER=groq

GROQ_VISION_MAX_OUTPUT_TOKENS=6144
GROQ_TEXT_MAX_TOKENS_ASK=1800
GROQ_TEXT_MAX_TOKENS_REPORT=2800
LIQUID_ASK_MAX_TOKENS=1800

LIQUID_ASK_GEMINI_RESEARCH=0
SCAN_AUTO_REPORT=1
NEXT_PUBLIC_SCAN_AUTO_REPORT=1

NEXT_PUBLIC_VISION_CONCURRENCY=2
NEXT_PUBLIC_SCAN_PRECISION_CROP_MAX=2
```

## What each guard does

| Flag | Effect |
|------|--------|
| `GROQ_PRIMARY_ONLY=1` | Vision + text use **Groq only** — no second provider on failure |
| `FREE_TIER_ONLY=1` | Blocks OpenAI + xAI even if keys exist |
| `LIQUID_ASK_GEMINI_RESEARCH=0` | Skips Gemini Google Search before Ask / session report |
| `SCAN_AUTO_REPORT=0` | Skips post-scan article (~2.8k Groq tokens per scan) |
| Lower `*_MAX_OUTPUT_TOKENS` | Caps vision + chat output size |

## Verify setup

1. Restart dev server after `.env.local` changes.
2. Sign in → open DevTools → `GET /api/scan/liquid-chat`
3. Expect: `textProviders: ["groq"]`, `groqPrimaryOnly: true`, `geminiAskResearch: false`

## Credit burn per 14-card binder scan (approx.)

| Step | Groq calls |
|------|------------|
| Vision (1 image, 14 cards) | 1× Scout (~6k out max) |
| Precision crop (weak rows) | 0–4 extra (if enabled, max 2 concurrent) |
| Liquid Ask | User-triggered (~1.8k tokens) |
| Session report | 1× (~2.8k tokens) if `SCAN_AUTO_REPORT=1` |

Market enrich + cert registry use **non-Groq** paths (eBay, PSA page, Apify) unless Pro research is on.

## Security

- Never commit `.env.local` (gitignored).
- Rotate keys if they appear in chat, screenshots, or logs.
- Set Groq project **spend limits** in the Groq dashboard.
- Use **Only allow these models** in the console (see list above).
