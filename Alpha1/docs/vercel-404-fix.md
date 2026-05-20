# Vercel 404 fix (NOT_FOUND on deploy URL)

## Symptom

Build logs show `/scanner`, `/api/...`, etc., but opening the deployment URL shows **404: NOT_FOUND**.

## Cause

The repo is a **monorepo**: the Next.js app lives in `Alpha1/`, not the git root.

If Vercel **Root Directory** is blank (`.`):

1. `npm run build --prefix Alpha1` can succeed (you see routes in logs).
2. Vercel still looks for the app output at the **repo root** → nothing to serve → platform 404.

## Fix (choose one)

### Option A — Recommended

Vercel → Project → **Settings → General → Root Directory** → set to:

```text
Alpha1
```

Save → **Redeploy** Production.

Remove or ignore the repo-root `vercel.json` if you use Option A (Vercel uses `Alpha1/` as project root).

### Option B — Keep Root Directory as `.`

Keep the repo-root `vercel.json` (sets `outputDirectory` to `Alpha1`) and redeploy.

## After redeploy

1. Open `https://YOUR-URL/scanner` (should load, not 404).
2. Open `https://YOUR-URL/` → should redirect to `/scanner`.
3. Set `NEXT_PUBLIC_APP_URL` to your Vercel URL (Phase 2).

## Production domain

GitHub lists: `pgt-collectibles.vercel.app` — use that URL for env vars and webhooks once deploy works.
