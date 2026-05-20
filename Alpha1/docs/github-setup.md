# GitHub — PGT Collectibles repo

## One-time: sign in to GitHub CLI

```powershell
gh auth login
```

Choose: **GitHub.com** → **HTTPS** → authenticate via **browser**.

## Create repo and push (from repo root `PGT_Vision`)

```powershell
cd C:\Users\jmrit\PGT_Vision

gh repo create PGT-Collectibles --public --source=. --remote=origin --description "PGT Collectibles — Pokémon TCG vision scanner" --push
```

GitHub repo name is `PGT-Collectibles` (no spaces). The display name on GitHub can be set to **PGT Collectibles** in repo Settings → General.

## If the repo already exists on GitHub

```powershell
git remote add origin https://github.com/YOUR_USERNAME/PGT-Collectibles.git
git push -u origin main
```

## Vercel

Import `PGT-Collectibles`, set **Root Directory** to `Alpha1`, add env from `.env.production` (Production).
