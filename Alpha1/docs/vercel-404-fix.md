# Vercel 404 fix (NOT_FOUND on deploy URL)

## Symptom

Build logs show `/liquid-scan`, `/api/...`, etc., but opening the deployment URL shows **404: NOT_FOUND**.

## Cause

The repo is a **monorepo**: the Next.js app lives in `Alpha1/`, not the git root.

If Vercel **Root Directory** is blank (`.`):

1. `npm run build --prefix Alpha1` can succeed (you see routes in logs).
2. Vercel still looks for the app output at the **repo root** → nothing to serve → platform 404.

## Fix

1. Vercel → **Settings → General → Root Directory** = `Alpha1` (you have this).
2. **Do not** use a repo-root `vercel.json` with custom `outputDirectory` — that forces Framework **Other** and causes 404.
3. **Framework Preset** = **Next.js** (default commands: `next build`, output `.next`).
4. **Deployments → Redeploy** Production (or promote latest `main` deployment).

### Yellow warning: “Production deployment differs from Project Settings”

That means the **live** site was built with old settings (often Framework **Other**). Settings are correct now, but you must **redeploy** so Production Overrides match Next.js + `Alpha1`.

## After redeploy

1. Open `https://YOUR-URL/liquid-scan` (should load, not 404).
2. Open `https://YOUR-URL/` → should redirect to `/liquid-scan`.
3. Open `https://YOUR-URL/scanner` → should redirect to `/liquid-scan` (legacy bookmark).
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL (Phase 2).

## Production domain

GitHub lists: `pgt-collectibles.vercel.app` — use that URL for env vars and webhooks once deploy works.
